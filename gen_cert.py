"""Genera un certificado SSL autofirmado para HTTPS local."""
import ssl
import tempfile
import os
import subprocess
import sys

CERT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cert.pem")
KEY_FILE  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "key.pem")

def generate_cert():
    """Genera cert.pem y key.pem usando Python ssl/OpenSSL."""
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        print("Certificados ya existen, reutilizando.")
        return True
    
    # Intentar con openssl command line
    try:
        # Buscar openssl en Python's directory
        python_dir = os.path.dirname(sys.executable)
        openssl_paths = [
            "openssl",
            os.path.join(python_dir, "Scripts", "openssl.exe"),
            os.path.join(python_dir, "Library", "bin", "openssl.exe"),
        ]
        
        openssl_cmd = None
        for p in openssl_paths:
            try:
                subprocess.run([p, "version"], capture_output=True, timeout=3)
                openssl_cmd = p
                break
            except Exception:
                continue
        
        if openssl_cmd:
            result = subprocess.run([
                openssl_cmd, "req", "-x509", "-newkey", "rsa:2048",
                "-keyout", KEY_FILE, "-out", CERT_FILE,
                "-days", "365", "-nodes",
                "-subj", "/CN=RankQR Local Server"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and os.path.exists(CERT_FILE):
                print("Certificado SSL generado correctamente.")
                return True
            else:
                print(f"Error openssl: {result.stderr}")
    except Exception as e:
        print(f"Error generando certificado: {e}")
    
    # Fallback: generar con Python puro
    try:
        import _ssl
        # Use Python's built-in test cert generation
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        
        # Generate using subprocess with Python's bundled openssl
        script = f'''
import ssl, os
os.environ["OPENSSL_CONF"] = ""
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
# This won't work without a cert, we need openssl
print("NEED_OPENSSL")
'''
        print("No se pudo generar certificado automaticamente.")
        return False
    except Exception:
        return False

if __name__ == "__main__":
    if generate_cert():
        print(f"cert.pem: {CERT_FILE}")
        print(f"key.pem:  {KEY_FILE}")
    else:
        print("FALLO: No se pudo generar el certificado.")
