/* ══════════════════════════════════════════════════════
   teacher.js – Dashboard del Profesor
   Escáner QR (UI), Ranking, Historial
══════════════════════════════════════════════════════ */

let _tScans    = 0;
let _tUniq     = new Set();
let _tPts      = 0;
let _qrRunning = false;
let _scanPaused = false;

// ═══════════════════════════════════════════
// INICIAR DASHBOARD DEL PROFESOR
// ═══════════════════════════════════════════
function initTeacher() {
  const t = currentUser;
  const loc = LOCS[t.locationId] || { name:'Sin asignar', icon:'📍' };

  // Llenar datos del sidebar
  document.getElementById('t-avatar').textContent = t.name.charAt(0);
  document.getElementById('t-name').textContent   = t.name;
  document.getElementById('t-loc').textContent    = `${loc.icon} ${loc.name}`;

  const select = document.getElementById('t-loc-select');
  if (select) {
    select.value = t.locationId;
  }

  // Cargar estadísticas del día
  _loadTodayStats();

  // Cargar ranking
  renderRanking('t-ranking');

  // Cargar historial
  _renderHistory();

  // Llenar selector de alumnos de prueba
  _populateTestStudents();

  // Mostrar sección scanner por defecto
  tShow('scanner');
}

function changeTeacherLocation(locId) {
  if (!currentUser) return;
  currentUser.locationId = locId;
  updateUser(currentUser.username, { locationId: locId });
  const loc = LOCS[locId] || { name:'Sin asignar', icon:'📍' };
  document.getElementById('t-loc').textContent = `${loc.icon} ${loc.name}`;
  
  // Recalcular estadísticas del día y recargar historial
  _loadTodayStats();
  _renderHistory();
  showToast(`Curso cambiado a ${loc.icon} ${loc.name}`, 'info', 2500);
}

// ═══════════════════════════════════════════
// NAVEGACIÓN SECCIONES
// ═══════════════════════════════════════════
function tShow(sec) {
  document.querySelectorAll('.t-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.snav').forEach(n => n.classList.remove('active'));
  document.getElementById(`ts-${sec}`).classList.add('active');
  document.getElementById(`snav-${sec}`).classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
}

// ═══════════════════════════════════════════
// CÁMARA / ESCÁNER (UI + html5-qrcode)
// ═══════════════════════════════════════════
async function startCamera() {
  if (_qrRunning) return;

  // Verificar que html5-qrcode esté disponible
  if (typeof Html5Qrcode === 'undefined') {
    showToast('La librería de escáner no está cargada aún.', 'warn');
    return;
  }

  const btnOn  = document.getElementById('btn-cam-on');
  const btnOff = document.getElementById('btn-cam-off');
  const status = document.getElementById('cam-status');
  const stxt   = document.getElementById('cam-status-txt');

  btnOn.disabled = true;
  btnOn.innerHTML = '<div class="spin"></div><span>Iniciando...</span>';

  try {
    _scanPaused = false;
    // Ocultar placeholder, mostrar reader
    document.getElementById('cam-placeholder').classList.add('hidden');
    document.getElementById('qr-reader').classList.remove('hidden');

    const qr = new Html5Qrcode('qr-reader');
    window._qrInstance = qr;

    await qr.start(
      { facingMode: 'environment' },
      { 
        fps: 25, 
        qrbox: function(w, h) {
          const size = Math.floor(Math.min(w, h) * 0.78);
          return { width: size, height: size };
        },
        aspectRatio: 1.0 
      },
      _onQRScan,
      () => {} // errores silenciosos
    );

    _qrRunning = true;
    btnOn.classList.add('hidden');
    btnOff.classList.remove('hidden');
    status.className = 'status-pill scanning';
    stxt.textContent = 'Cámara activa — Buscando QR...';
    showToast('Cámara activada. Apunta al QR del alumno.', 'ok', 3000);

  } catch (err) {
    console.error(err);
    document.getElementById('cam-placeholder').classList.remove('hidden');
    document.getElementById('qr-reader').classList.add('hidden');
    btnOn.disabled = false;
    btnOn.innerHTML = '<i class="fas fa-camera"></i> Iniciar Cámara';

    let msg = 'No se pudo acceder a la cámara. ';
    if (err.name === 'NotAllowedError' || String(err).includes('NotAllowed')) {
      msg += 'Permite el permiso de cámara en el navegador.';
    } else {
      msg += 'Usa un servidor local (no file://).';
    }
    showToast(msg, 'err', 7000);
  }
}

async function stopCamera() {
  if (!_qrRunning || !window._qrInstance) return;
  try {
    await window._qrInstance.stop();
    window._qrInstance.clear();
  } catch(e) {}
  window._qrInstance = null;
  _qrRunning = false;

  document.getElementById('cam-placeholder').classList.remove('hidden');
  document.getElementById('qr-reader').classList.add('hidden');
  document.getElementById('btn-cam-on').classList.remove('hidden');
  document.getElementById('btn-cam-on').disabled = false;
  document.getElementById('btn-cam-on').innerHTML = '<i class="fas fa-camera"></i> Iniciar Cámara';
  document.getElementById('btn-cam-off').classList.add('hidden');
  document.getElementById('cam-status').className = 'status-pill idle';
  document.getElementById('cam-status-txt').textContent = 'Cámara inactiva';
  showToast('Cámara detenida.', 'info', 2000);
}

// ── Procesar escaneo QR ──
async function _onQRScan(text) {
  if (_scanPaused) return;
  _scanPaused = true;

  // Pausar el escáner para que no siga disparando
  try { if (window._qrInstance) await window._qrInstance.pause(true); } catch(e) {}

  showToast('¡QR Reconocido! Abriendo interfaz...', 'ok', 1500);

  let clean = (text || '').trim();
  let username = null;
  
  // Soporte para QR con prefijo RANKQR: (generado por la app)
  if (clean.toUpperCase().startsWith('RANKQR:')) {
    username = clean.substring(7).trim().toLowerCase();
  } else {
    // QR sin prefijo (imágenes externas como qr_anneliz.png, qr_usuario1.png, etc.)
    const candidates = Object.keys(getUsers());
    const found = candidates.find(u => clean.toLowerCase() === u.toLowerCase());
    username = found || clean.toLowerCase();
  }

  _processScan(username);
}

function _processScan(username) {
  const users   = getUsers();
  const student = users[username];

  if (!student || student.role !== 'student') {
    playSound('error');
    _showResult('err', 'QR inválido', 'No se encontró ningún alumno con ese código.', null);
    _resumeScan(2000);
    return;
  }

  // Mostrar modal de confirmación con selector de curso
  playSound('success');
  _showAssignModal(username, student);
}

// ── Modal de asignación de punto ──
function _showAssignModal(username, student) {
  const modal = document.getElementById('assign-modal');
  if (!modal) return;

  // Llenar datos del alumno
  document.getElementById('am-avatar').textContent = student.name.charAt(0);
  document.getElementById('am-name').textContent = student.name;
  document.getElementById('am-pts').textContent = `${student.points || 0} pts acumulados`;

  // Llenar selector de cursos
  const select = document.getElementById('am-course-select');
  const visited = student.visitedLocations || [];
  select.innerHTML = Object.values(LOCS).map(loc => {
    const done = visited.includes(loc.id);
    return `<option value="${loc.id}" ${done ? 'style="color:#888"' : ''}>${loc.icon} ${loc.name} ${done ? '(ya registrado)' : ''}</option>`;
  }).join('');
  
  // Pre-seleccionar el curso actual del profesor
  if (currentUser.locationId) {
    select.value = currentUser.locationId;
  }

  // Guardar username en el modal para cuando confirme
  modal.dataset.username = username;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function confirmAssignPoint() {
  const modal = document.getElementById('assign-modal');
  const username = modal.dataset.username;
  const locId = document.getElementById('am-course-select').value;
  
  if (!username || !locId) return;

  const users = getUsers();
  const student = users[username];
  if (!student) return;

  const visited = student.visitedLocations || [];
  const isRepeat = visited.includes(locId);
  const ptsToAward = isRepeat ? 1 : 2;
  const newPts = (student.points || 0) + ptsToAward;
  const newVisited = isRepeat ? visited : [...visited, locId];
  
  // Actualizar curso activo del profesor
  currentUser.locationId = locId;
  updateUser(currentUser.username, { locationId: locId });

  // Guardar puntos del alumno
  updateUser(username, { points: newPts, visitedLocations: newVisited });

  // Registrar en historial
  const scans = getScans();
  const scanId = 'scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  scans.unshift({
    id:             scanId,
    studentUsername: username,
    studentName:    student.name,
    teacherName:    currentUser.name,
    locationName:   LOCS[locId].name,
    locationId:     locId,
    pts:            ptsToAward,
    time:           Date.now(),
  });
  saveScans(scans.slice(0, 100));

  // Actualizar stats
  _tScans++;
  _tUniq.add(username);
  _tPts += ptsToAward;
  _updateStatUI();

  // Cerrar modal y feedback
  modal.classList.add('hidden');
  modal.style.display = 'none';

  const updated = { ...student, points: newPts, visitedLocations: newVisited };
  const title = isRepeat ? '¡Punto por Repetición!' : '¡Primera Visita!';
  const detail = `+${ptsToAward} punto${ptsToAward > 1 ? 's' : ''} · ${LOCS[locId].icon} ${LOCS[locId].name}`;

  playSound('success');
  _showResult('ok', title, detail, updated);
  showScanModal('ok', title, student.name, `${detail} · Total: ${newPts} pts`);
  launchConfetti();
  _renderHistory();
  renderRanking('t-ranking');

  // Actualizar sidebar del profesor
  const loc = LOCS[locId] || { name:'Sin asignar', icon:'📍' };
  document.getElementById('t-loc').textContent = `${loc.icon} ${loc.name}`;
  const locSelect = document.getElementById('t-loc-select');
  if (locSelect) locSelect.value = locId;

  _resumeScan(2000);
}

function cancelAssignPoint() {
  const modal = document.getElementById('assign-modal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
  _resumeScan(500);
}

function _resumeScan(delay = 2000) {
  setTimeout(async () => {
    _scanPaused = false;
    if (window._qrInstance && _qrRunning) {
      try { 
        await window._qrInstance.resume(); 
      } catch(e) {
        // Si resume falla, reiniciar el escáner completamente
        console.log('Resume falló, reiniciando escáner...');
        try {
          await window._qrInstance.stop();
          window._qrInstance.clear();
        } catch(e2) {}
        window._qrInstance = null;
        _qrRunning = false;
        _scanPaused = false;
        // Reiniciar automáticamente
        startCamera();
      }
    }
  }, delay);
}

// ── Mostrar resultado en la tarjeta ──
function _showResult(type, title, detail, student) {
  document.getElementById('result-idle').classList.add('hidden');
  const rc = document.getElementById('result-content');
  rc.classList.remove('hidden');

  const iconMap  = { ok:'check-circle', warn:'exclamation-circle', err:'times-circle' };
  const colorMap = { ok:'#10b981', warn:'#f59e0b', err:'#ef4444' };

  rc.innerHTML = `
    <div class="rc-icon" style="color:${colorMap[type]}">
      <i class="fas fa-${iconMap[type]}"></i>
    </div>
    <p class="rc-title">${title}</p>
    ${student ? `
      <div class="rc-student">
        <div class="rc-av">${student.name.charAt(0)}</div>
        <div class="rc-info">
          <strong>${student.name}</strong>
          <span>${type==='ok' ? `Total: ${student.points} pts` : detail}</span>
        </div>
        ${type==='ok' ? `<div class="rc-badge">+1 ⭐</div>` : ''}
      </div>
    ` : `<p style="font-size:.82rem;color:var(--txt2)">${detail}</p>`}
    <button class="btn-rescan" onclick="_resetResult()">
      <i class="fas fa-redo"></i> Escanear otro
    </button>
  `;
}

async function _resetResult() {
  document.getElementById('result-idle').classList.remove('hidden');
  document.getElementById('result-content').classList.add('hidden');
  _scanPaused = false;
  if (window._qrInstance && _qrRunning) {
    try { await window._qrInstance.resume(); } catch(e) {}
  }
}

// ═══════════════════════════════════════════
// ESTADÍSTICAS DEL DÍA
// ═══════════════════════════════════════════
function _loadTodayStats() {
  const today  = new Date(); today.setHours(0,0,0,0);
  const scans  = getScans().filter(s => s.time >= today.getTime() && s.teacherName === currentUser.name);
  _tScans = scans.length;
  _tUniq  = new Set(scans.map(s => s.studentName));
  _tPts   = scans.reduce((a,s) => a + (s.pts||0), 0);
  _updateStatUI();
}

function _updateStatUI() {
  document.getElementById('stat-scans').textContent = _tScans;
  document.getElementById('stat-uniq').textContent  = _tUniq.size;
  document.getElementById('stat-pts').textContent   = _tPts;
}

// ═══════════════════════════════════════════
// HISTORIAL
// ═══════════════════════════════════════════
function _renderHistory() {
  const el     = document.getElementById('t-hist');
  const myName = currentUser.name;
  const scans  = getScans().filter(s => s.teacherName === myName);

  if (scans.length === 0) {
    el.innerHTML = `
      <div class="hist-empty">
        <i class="fas fa-inbox"></i>
        <h4>Sin escaneos aún</h4>
        <p>Los alumnos escaneados aparecerán aquí</p>
      </div>
    `;
    return;
  }

  el.innerHTML = scans.map(s => {
    const d   = new Date(s.time);
    const loc = LOCS[s.locationId] || { icon:'📍' };
    const ts  = d.toLocaleString('es',{ hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' });
    return `
      <div class="hist-item">
        <div class="hi-av">${s.studentName.charAt(0)}</div>
        <div class="hi-info">
          <strong>${s.studentName}</strong>
          <span>${loc.icon} ${s.locationName}</span>
        </div>
        <div class="hi-right" style="display:flex; align-items:center; gap:0.6rem;">
          <div>
            <span class="hi-pts">+${s.pts} ⭐</span>
            <span class="hi-time" style="display:block; font-size:0.7rem; color:var(--txt3);">${ts}</span>
          </div>
          <button class="btn-del-pt" onclick="undoScan('${s.id || s.time}')" title="Anular / Eliminar punto del alumno" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:0.4rem 0.6rem; cursor:pointer; transition:all 0.2s;">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function clearHistory() {
  const myName = currentUser.name;
  const scans  = getScans().filter(s => s.teacherName !== myName);
  saveScans(scans);
  _renderHistory();
  showToast('Historial limpiado.', 'info', 2500);
}

// ═══════════════════════════════════════════
// REFRESH (llamado por sync cross-tab)
// ═══════════════════════════════════════════
function _refreshTeacherRanking() {
  renderRanking('t-ranking');
  _renderHistory();
}

// ═══════════════════════════════════════════
// SIMULACIÓN DE PRUEBAS
// ═══════════════════════════════════════════
function _populateTestStudents() {
  const select = document.getElementById('test-student-select');
  if (!select) return;

  const users = getUsers();
  const students = Object.values(users).filter(u => u.role === 'student');

  select.innerHTML = '<option value="">Selecciona un alumno...</option>' + 
    students.map(s => `<option value="${s.username}">${s.name}</option>`).join('');
}

function simulateQRScan() {
  const select = document.getElementById('test-student-select');
  if (!select) return;

  const username = select.value;
  if (!username) {
    showToast('Selecciona un alumno para simular el escaneo', 'warn');
    playSound('error');
    return;
  }

  const users = getUsers();
  showToast(`Simulando escaneo de ${users[username] ? users[username].name : username}...`, 'info', 1500);
  
  // Procesar escaneo
  _processScan(username);
  
  // Limpiar selección después de simular
  select.value = '';
}
