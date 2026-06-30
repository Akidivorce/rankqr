"""
server.py - Servidor RankQR con HTTPS (para cámara en celulares)
y API JSON para sincronización multidispositivo.
"""
import http.server
import json
import os
import socket
import ssl
import sys
import threading

PORT_HTTP  = 8080
PORT_HTTPS = 8443
DB_DIR  = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(DB_DIR, "database.json")
CERT    = os.path.join(DB_DIR, "cert.pem")
KEY     = os.path.join(DB_DIR, "key.pem")

DEFAULT_DATA = {
    "users": {
        "prof1":    {"username":"prof1","password":"123456","name":"Profesor","role":"teacher","locationId":"matematica"},
        "anneliz":  {"username":"anneliz","password":"123456","name":"Anneliz","role":"student","points":0,"visitedLocations":[]},
        "jonathan": {"username":"jonathan","password":"123456","name":"Jonathan","role":"student","points":0,"visitedLocations":[]}
    },
    "scans": []
}

db_lock = threading.Lock()

def read_db():
    with db_lock:
        if not os.path.exists(DB_FILE):
            with open(DB_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_DATA, f, ensure_ascii=False, indent=2)
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return DEFAULT_DATA

def write_db(data):
    with db_lock:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DB_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/api/data":
            self._send_json(200, read_db())
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/save":
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length)
                payload = json.loads(raw.decode("utf-8"))
                write_db(payload)
                self._send_json(200, {"status": "ok"})
            except Exception as e:
                self._send_json(500, {"status": "error", "msg": str(e)})
        else:
            self._send_json(404, {"status": "not found"})

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=True).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        try:
            if self.path == "/api/data":
                return
        except Exception:
            pass
        try:
            sys.stderr.write("[server] %s\n" % (fmt % args))
            sys.stderr.flush()
        except Exception:
            pass


class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def run_http_redirect(ip):
    """Servidor HTTP que redirige al HTTPS."""
    class RedirectHandler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            host = self.headers.get("Host", f"{ip}:{PORT_HTTPS}")
            # Strip port from host if present
            hostname = host.split(":")[0]
            target = f"https://{hostname}:{PORT_HTTPS}{self.path}"
            self.send_response(301)
            self.send_header("Location", target)
            self.end_headers()

        def do_POST(self):
            self.do_GET()

        def log_message(self, *a):
            pass

    try:
        httpd = Server(("0.0.0.0", PORT_HTTP), RedirectHandler)
        httpd.serve_forever()
    except Exception:
        pass


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    # ── Detectar si estamos en la NUBE (Render, etc.) ──
    cloud_port = os.environ.get("PORT")

    if cloud_port:
        # EN LA NUBE: Render provee HTTPS automáticamente, usamos HTTP simple
        port = int(cloud_port)
        server = Server(("0.0.0.0", port), Handler)
        print(f"☁️  RankQR corriendo en la NUBE en puerto {port}")
        sys.stdout.flush()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.server_close()
    else:
        # EN LOCAL: Usar HTTPS para cámara en celular
        ip = get_local_ip()
        has_ssl = os.path.exists(CERT) and os.path.exists(KEY)

        if has_ssl:
            t = threading.Thread(target=run_http_redirect, args=(ip,), daemon=True)
            t.start()

            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(CERT, KEY)
            server = Server(("0.0.0.0", PORT_HTTPS), Handler)
            server.socket = ctx.wrap_socket(server.socket, server_side=True)

            print("=" * 60)
            print("  SERVIDOR RANKQR - HTTPS ACTIVO (CAMARA HABILITADA)")
            print("=" * 60)
            print(f"  PC:       https://localhost:{PORT_HTTPS}")
            print(f"  CELULAR:  https://{ip}:{PORT_HTTPS}")
            print("=" * 60)
            sys.stdout.flush()

            try:
                server.serve_forever()
            except KeyboardInterrupt:
                print("\nServidor detenido.")
                server.server_close()
        else:
            server = Server(("0.0.0.0", PORT_HTTP), Handler)
            print("=" * 60)
            print("  SERVIDOR RANKQR - HTTP (sin camara en celular)")
            print("=" * 60)
            print(f"  PC:       http://localhost:{PORT_HTTP}")
            print(f"  CELULAR:  http://{ip}:{PORT_HTTP}")
            print("  NOTA: Para camara en celular, ejecuta gen_cert.py primero")
            print("=" * 60)
            sys.stdout.flush()

            try:
                server.serve_forever()
            except KeyboardInterrupt:
                print("\nServidor detenido.")
                server.server_close()

