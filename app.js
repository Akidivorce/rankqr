/* ══════════════════════════════════════════════════════
   app.js – Lógica principal de RankQR
   Sin Firebase — usa localStorage como base de datos local
══════════════════════════════════════════════════════ */

// ── Cursos disponibles ──
const LOCS = {
  matematica:   { id:'matematica',   name:'Matemática',   icon:'📐', color:'#0ea5e9' },
  comunicacion: { id:'comunicacion', name:'Comunicación', icon:'✍️', color:'#f43f5e' },
  dpsc:         { id:'dpsc',         name:'DPSC',         icon:'⚖️', color:'#a855f7' },
  ingles:       { id:'ingles',       name:'Inglés',       icon:'💬', color:'#14b8a6' },
  ciencia:      { id:'ciencia',      name:'Ciencia',      icon:'🧪', color:'#10b981' },
  arte:         { id:'arte',         name:'Arte',         icon:'🎨', color:'#ec4899' },
  ed_fisica:    { id:'ed_fisica',    name:'Ed. Física',   icon:'⚽', color:'#f59e0b' },
};

// ── Usuarios ──
const DEMO_USERS = {
  prof1:     { username:'prof1',     password:'123456', name:'Profesor', role:'teacher', locationId:'matematica' },
  anneliz:   { username:'anneliz',   password:'123456', name:'Anneliz',  role:'student', points:0, visitedLocations:[] },
  jonathan:  { username:'jonathan',  password:'123456', name:'Jonathan', role:'student', points:0, visitedLocations:[] },
};

// ── Historial inicial de escaneos ──
const DEMO_SCANS = [];

// ═══════════════════════════════════════════
// INICIALIZACIÓN DEL STORE (localStorage + Backend Sync)
// ═══════════════════════════════════════════
function initStore() {
  const schemaVersion = 'v_courses_11';
  if (localStorage.getItem('rqr_schema_version') !== schemaVersion) {
    localStorage.removeItem('rqr_users');
    localStorage.removeItem('rqr_scans');
    localStorage.removeItem('rqr_session'); // Clear active session to reload fresh
    localStorage.setItem('rqr_schema_version', schemaVersion);
  }

  if (!localStorage.getItem('rqr_users')) {
    localStorage.setItem('rqr_users', JSON.stringify(DEMO_USERS));
  }
  if (!localStorage.getItem('rqr_scans')) {
    localStorage.setItem('rqr_scans', JSON.stringify(DEMO_SCANS));
  }
}

let _useApiSync = false;
let _isSyncing = false;

async function initBackendSync() {
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const data = await res.json();
      if (data && data.users) {
        _useApiSync = true;
        localStorage.setItem('rqr_users', JSON.stringify(data.users));
        if (data.scans) localStorage.setItem('rqr_scans', JSON.stringify(data.scans));
        console.log('🌐 Sincronizado en tiempo real con servidor backend multidispositivo');
      }
    }
  } catch(e) {
    console.log('⚡ Modo almacenamiento local activo');
  }

  // Polling automático cada 1.5s para mantener todos los dispositivos conectados en tiempo real
  setInterval(async () => {
    if (!_useApiSync || _isSyncing) return;
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        if (data && data.users) {
          const oldUsers = localStorage.getItem('rqr_users');
          const oldScans = localStorage.getItem('rqr_scans');
          const newUsers = JSON.stringify(data.users);
          const newScans = JSON.stringify(data.scans || []);
          if (oldUsers !== newUsers || oldScans !== newScans) {
            localStorage.setItem('rqr_users', newUsers);
            localStorage.setItem('rqr_scans', newScans);
            if (currentUser) {
              const fresh = getUser(currentUser.username);
              if (fresh) {
                currentUser = fresh;
                if (currentUser.role === 'student' && typeof refreshStudentUI === 'function') refreshStudentUI();
                if (currentUser.role === 'teacher') {
                  if (typeof _loadTodayStats === 'function') _loadTodayStats();
                  if (typeof _renderHistory === 'function') _renderHistory();
                  if (typeof renderRanking === 'function') renderRanking('t-ranking');
                }
              }
            }
          }
        }
      }
    } catch(e) {}
  }, 1500);
}

async function _syncToBackend() {
  if (!_useApiSync) return;
  _isSyncing = true;
  try {
    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: getUsers(),
        scans: getScans()
      })
    });
  } catch(e) {
    console.error('Error sincronizando al servidor:', e);
  } finally {
    _isSyncing = false;
  }
}

function getUsers()  { return JSON.parse(localStorage.getItem('rqr_users') || '{}'); }
function getScans()  { return JSON.parse(localStorage.getItem('rqr_scans') || '[]'); }
function saveUsers(u){ 
  localStorage.setItem('rqr_users', JSON.stringify(u)); 
  _syncToBackend();
}
function saveScans(s){ 
  localStorage.setItem('rqr_scans', JSON.stringify(s)); 
  _syncToBackend();
}

function getUser(username) { return getUsers()[username] || null; }
function updateUser(username, data) {
  const users = getUsers();
  users[username] = { ...users[username], ...data };
  saveUsers(users);
  localStorage.setItem('rqr_sync', Date.now().toString());
}

// ── Eliminar / Anular punto (Undo) ──
function undoScan(scanTimeOrId) {
  if (!confirm('¿Estás seguro de eliminar este punto/registro del alumno? Se restarán los puntos otorgados.')) {
    return;
  }
  const scans = getScans();
  const scanIdx = scans.findIndex(s => s.time == scanTimeOrId || s.id == scanTimeOrId);
  if (scanIdx === -1) {
    showToast('No se encontró el registro en el historial.', 'warn');
    return;
  }
  const targetScan = scans[scanIdx];
  
  const users = getUsers();
  let student = targetScan.studentUsername ? users[targetScan.studentUsername] : null;
  if (!student) {
    student = Object.values(users).find(u => u.role === 'student' && u.name === targetScan.studentName);
  }

  if (student) {
    const ptsToRemove = targetScan.pts || 1;
    const newPts = Math.max(0, (student.points || 0) - ptsToRemove);
    let newVisited = [...(student.visitedLocations || [])];
    if (ptsToRemove >= 2) {
      const locIdx = newVisited.indexOf(targetScan.locationId);
      if (locIdx !== -1) newVisited.splice(locIdx, 1);
    }
    users[student.username] = { ...student, points: newPts, visitedLocations: newVisited };
    saveUsers(users);
  }

  scans.splice(scanIdx, 1);
  saveScans(scans);
  
  if (typeof playSound === 'function') playSound('error');
  showToast(`Punto anulado correctamente (-${targetScan.pts || 1} pts).`, 'info', 3500);

  if (currentUser && currentUser.role === 'teacher') {
    if (typeof _loadTodayStats === 'function') _loadTodayStats();
    if (typeof _renderHistory === 'function') _renderHistory();
    if (typeof renderRanking === 'function') renderRanking('t-ranking');
  }
  localStorage.setItem('rqr_sync', Date.now().toString());
}

// ═══════════════════════════════════════════
// SESIÓN
// ═══════════════════════════════════════════
function getSession()  { return JSON.parse(localStorage.getItem('rqr_session') || 'null'); }
function setSession(u) { localStorage.setItem('rqr_session', JSON.stringify(u)); }
function clearSession(){ localStorage.removeItem('rqr_session'); }

let currentUser = null; // datos del usuario logueado

// ═══════════════════════════════════════════
// ARRANQUE
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initStore();
  initBackendSync();

  const session = getSession();
  if (session) {
    const fresh = getUser(session.username);
    if (fresh) {
      currentUser = fresh;
      routeUser();
    } else {
      showView('view-login');
    }
  } else {
    showView('view-login');
  }

  // Escuchar cambios entre pestañas (para sync en tiempo real)
  window.addEventListener('storage', (e) => {
    if (e.key === 'rqr_sync' && currentUser) {
      const fresh = getUser(currentUser.username);
      if (fresh) {
        currentUser = fresh;
        if (currentUser.role === 'student') refreshStudentUI();
        if (currentUser.role === 'teacher') refreshTeacherStats();
      }
    }
  });
});

function routeUser() {
  if (currentUser.role === 'teacher') {
    showView('view-teacher');
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');
    initTeacher();
  } else {
    showView('view-student');
    initStudent();
  }
}

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('inp-user').value.trim().toLowerCase();
  const password = document.getElementById('inp-pass').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('btn-login');

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div><span>Verificando...</span>';

  setTimeout(() => {
    const user = getUser(username);
    if (!user || user.password !== password) {
      errEl.classList.remove('hidden');
      document.getElementById('login-error-msg').textContent = 'Usuario o contraseña incorrectos.';
      btn.disabled = false;
      btn.innerHTML = '<span>Ingresar</span><i class="fas fa-arrow-right"></i>';
      return;
    }

    currentUser = user;
    setSession({ username: user.username });
    routeUser();
    showToast(`¡Bienvenido, ${user.name.split(' ')[0]}! 👋`, 'ok');

    // Restaurar botón para futuras ocasiones (o logout)
    btn.disabled = false;
    btn.innerHTML = '<span>Ingresar</span><i class="fas fa-arrow-right"></i>';
  }, 600);
}

function logout() {
  // Detener escáner si estaba activo
  if (window._qrInstance) {
    try { window._qrInstance.stop(); } catch(e) {}
    window._qrInstance = null;
  }
  clearSession();
  currentUser = null;
  showView('view-login');
  // Limpiar form
  document.getElementById('login-form').reset();
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('demo-list').classList.add('hidden');
  document.getElementById('demo-chevron').style.transform = '';
  document.querySelector('.demo-toggle').classList.remove('open');

  // Asegurar que el botón esté restaurado
  const btn = document.getElementById('btn-login');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span>Ingresar</span><i class="fas fa-arrow-right"></i>';
  }
}

// ═══════════════════════════════════════════
// VISTAS
// ═══════════════════════════════════════════
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ═══════════════════════════════════════════
// LOGIN HELPERS
// ═══════════════════════════════════════════
function togglePass() {
  const inp  = document.getElementById('inp-pass');
  const icon = document.getElementById('eye-icon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    inp.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

function toggleDemo() {
  const list    = document.getElementById('demo-list');
  const btn     = document.querySelector('.demo-toggle');
  const chevron = document.getElementById('demo-chevron');
  const open    = !list.classList.contains('hidden');
  list.classList.toggle('hidden', open);
  btn.classList.toggle('open', !open);
}

function autofill(user, pass) {
  document.getElementById('inp-user').value = user;
  document.getElementById('inp-pass').value = pass;
  document.getElementById('demo-list').classList.add('hidden');
  document.querySelector('.demo-toggle').classList.remove('open');
  showToast('Credenciales cargadas ✓', 'info', 2500);
}

// ═══════════════════════════════════════════
// SIDEBAR MOBILE
// ═══════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const sb  = document.getElementById('sidebar');
  const ham = document.querySelector('.ham');
  if (sb && ham && !sb.contains(e.target) && !ham.contains(e.target)) {
    sb.classList.remove('open');
  }
});

// ═══════════════════════════════════════════
// RENDER RANKING (compartido)
// ═══════════════════════════════════════════
function renderRanking(containerId, highlightUser = null) {
  const users    = getUsers();
  const students = Object.values(users)
    .filter(u => u.role === 'student')
    .sort((a,b) => (b.points || 0) - (a.points || 0));

  const el = document.getElementById(containerId);
  if (!el) return;

  if (students.length === 0) {
    el.innerHTML = `<div class="rk-empty"><i class="fas fa-trophy"></i><p>No hay alumnos registrados</p></div>`;
    return;
  }

  const medals = ['🥇','🥈','🥉'];
  const cls    = ['gold','silver','bronze'];

  const header = `
    <div class="rk-head-row">
      <span>#</span><span>Alumno</span>
      <span style="text-align:center">Cursos</span>
      <span style="text-align:center">Pts</span>
    </div>
  `;

  const rows = students.map((s, i) => {
    const rank    = i + 1;
    const isMe    = highlightUser && s.username === highlightUser;
    const visited = s.visitedLocations || [];
    const topCls  = cls[i] || '';

    return `
      <div class="rk-row ${isMe ? 'me' : ''} ${topCls}">
        <div class="rk-pos">
          ${medals[i] ? `<span class="rk-medal">${medals[i]}</span>` : `<span class="rk-num">${rank}</span>`}
        </div>
        <div class="rk-stu">
          <div class="rk-av ${isMe ? 'me-av' : ''}">${s.name.charAt(0)}</div>
          <span class="rk-sname">${s.name}${isMe ? '<span class="you-tag">TÚ</span>' : ''}</span>
        </div>
        <div class="rk-dots">
          ${Object.keys(LOCS).map(k => `
            <div class="loc-dot ${visited.includes(k) ? 'on' : ''}" title="${LOCS[k].name}"></div>
          `).join('')}
        </div>
        <div class="rk-pts-col">
          <span class="rk-pts-n">${s.points || 0}</span>
          <span class="rk-pts-u">pts</span>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = header + rows;

  // Re-aplicar filtro si hay una búsqueda activa
  const searchInputId = containerId === 't-ranking' ? 't-rank-search' : 's-rank-search';
  const searchInp = document.getElementById(searchInputId);
  if (searchInp && searchInp.value) {
    filterRanking(containerId, searchInp.value, highlightUser);
  }
}

// ═══════════════════════════════════════════
// TOASTS
// ═══════════════════════════════════════════
function showToast(msg, type = 'info', duration = 4500) {
  const container = document.getElementById('toasts');
  if (!container) return;

  const icons = { ok:'check-circle', err:'times-circle', warn:'exclamation-triangle', info:'info-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <i class="fas fa-${icons[type] || 'info-circle'}"></i>
    <span>${msg}</span>
    <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(t);

  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));

  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 400);
  }, duration);
}

// ═══════════════════════════════════════════
// MODAL ESCANEO
// ═══════════════════════════════════════════
function showScanModal(type, title, studentName, detail) {
  const modal = document.getElementById('scan-modal');
  const icon  = document.getElementById('smc-icon');
  const iMap  = { ok:'check-circle', warn:'exclamation-circle', err:'times-circle' };

  icon.className = `smc-icon ${type}`;
  icon.innerHTML = `<i class="fas fa-${iMap[type]}"></i>`;
  document.getElementById('smc-title').textContent  = title;
  document.getElementById('smc-name').textContent   = studentName;
  document.getElementById('smc-detail').textContent = detail;
  document.getElementById('smc-av').textContent     = studentName.charAt(0);

  modal.classList.remove('hidden');
  if (type === 'ok') setTimeout(closeScanModal, 4000);
}

function closeScanModal() {
  document.getElementById('scan-modal').classList.add('hidden');
}

// ═══════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════
function launchConfetti() {
  const colors = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#fff'];
  for (let i = 0; i < 45; i++) {
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.cssText = `
      left:${Math.random()*100}vw;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-delay:${(Math.random()*.5).toFixed(2)}s;
      animation-duration:${(Math.random()*.8+1).toFixed(2)}s;
      width:${Math.random()*8+4}px;height:${Math.random()*8+4}px;
      border-radius:${Math.random()>.5?'50%':'2px'};
      transform:rotate(${Math.floor(Math.random()*360)}deg);
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2500);
  }
}

// ═══════════════════════════════════════════
// SONIDOS (Web Audio API sintético)
// ═══════════════════════════════════════════
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      // Tono ascendente agradable (bip bip)
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'error') {
      // Tono bajo tipo zumbido
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn('AudioContext no soportado:', e);
  }
}

// ═══════════════════════════════════════════
// FILTRAR RANKING (Búsqueda en tiempo real)
// ═══════════════════════════════════════════
function filterRanking(containerId, searchQuery, highlightUser = null) {
  const query = searchQuery.trim().toLowerCase();
  const rows = document.querySelectorAll(`#${containerId} .rk-row`);
  
  rows.forEach(row => {
    // Ignorar cabeceras
    if (row.classList.contains('rk-head-row')) return;
    
    const nameEl = row.querySelector('.rk-sname');
    if (!nameEl) return;
    
    const studentName = nameEl.textContent.toLowerCase();
    if (studentName.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ═══════════════════════════════════════════
// EXPORTAR RANKING A CSV
// ═══════════════════════════════════════════
function exportRankingToCSV() {
  const users = getUsers();
  const students = Object.values(users)
    .filter(u => u.role === 'student')
    .sort((a,b) => (b.points || 0) - (a.points || 0));

  if (students.length === 0) {
    showToast('No hay alumnos registrados para exportar', 'warn');
    playSound('error');
    return;
  }

  // Generar CSV
  let csvContent = "\uFEFF"; // BOM para caracteres especiales en Excel (como acentos)
  csvContent += "Puesto,Alumno,Código,Puntos,Cursos Registrados\n";
  
  students.forEach((s, idx) => {
    const visitedStr = (s.visitedLocations || []).map(k => LOCS[k] ? LOCS[k].name : k).join(" | ");
    csvContent += `${idx + 1},"${s.name}","${s.username}",${s.points || 0},"${visitedStr}"\n`;
  });

  // Crear archivo y descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `ranking_escolar_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Ranking exportado a CSV ✓', 'ok');
  playSound('success');
}

// ═══════════════════════════════════════════
// REFRESH HOOKS (llamados por sync entre pestañas)
// ═══════════════════════════════════════════
function refreshStudentUI() {
  // Implementado en student.js
  if (typeof _refreshStudent === 'function') _refreshStudent();
}
function refreshTeacherStats() {
  // Implementado en teacher.js
  if (typeof _refreshTeacherRanking === 'function') _refreshTeacherRanking();
}
