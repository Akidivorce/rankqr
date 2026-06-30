/* ══════════════════════════════════════════════════════
   student.js – Dashboard del Alumno
   QR generado, puntos, localidades, ranking
══════════════════════════════════════════════════════ */

let _qrBuilt   = false;
let _prevPts   = 0;

// ═══════════════════════════════════════════
// INICIAR DASHBOARD DEL ALUMNO
// ═══════════════════════════════════════════
function initStudent() {
  _prevPts = currentUser.points || 0;
  _qrBuilt = false;

  // Header
  document.getElementById('s-avatar').textContent = currentUser.name.charAt(0);
  document.getElementById('s-name').textContent   = currentUser.name;

  // Construir QR
  _buildQR();

  // Actualizar toda la UI con los datos actuales
  _refreshStudent();

  // Mostrar sección QR por defecto
  sShow('qr');
}

// ═══════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════
function sShow(sec) {
  document.querySelectorAll('.stu-sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  document.getElementById(`ss-${sec}`).classList.add('active');
  document.getElementById(`stab-${sec}`).classList.add('active');
}

// ═══════════════════════════════════════════
// GENERAR CÓDIGO QR
// ═══════════════════════════════════════════
function _buildQR() {
  if (_qrBuilt) return;
  const container = document.getElementById('qr-canvas');
  if (!container || typeof QRCode === 'undefined') return;

  container.innerHTML = '';
  // Fondo blanco para contraste máximo con la cámara
  container.style.background = '#ffffff';
  container.style.padding = '12px';
  container.style.borderRadius = '12px';
  container.style.display = 'inline-block';

  try {
    new QRCode(container, {
      text:         `RANKQR:${currentUser.username}`,
      width:        220,
      height:       220,
      colorDark:    '#000000',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });

    const shortId = currentUser.username.toUpperCase();
    document.getElementById('qr-uid').textContent = `ID: ${shortId}`;
    _qrBuilt = true;
  } catch(e) {
    container.innerHTML = `<div style="padding:2rem;color:#ef4444;text-align:center;font-size:.85rem"><i class="fas fa-exclamation-triangle"></i><br>Error al generar QR. Recarga la página.</div>`;
  }
}

// ═══════════════════════════════════════════
// ACTUALIZAR UI DEL ALUMNO
// ═══════════════════════════════════════════
function _refreshStudent() {
  // Recargar datos frescos del store
  const fresh = getUser(currentUser.username);
  if (fresh) currentUser = fresh;

  const pts     = currentUser.points || 0;
  const visited = currentUser.visitedLocations || [];

  // Celebrar si subieron los puntos
  if (pts > _prevPts) {
    _celebratePts();
    showToast(`¡+${pts - _prevPts} punto${pts-_prevPts>1?'s':''}! Sigue registrando tus cursos 🎉`, 'ok', 5000);
    _prevPts = pts;
  }

  // Header points
  document.getElementById('s-pts-hdr').textContent = pts;

  // QR badge
  document.getElementById('qr-stu-name').textContent = currentUser.name;
  document.getElementById('qr-pts').textContent      = pts;

  // Big counter
  _animCounter('s-pts-big', pts);

  // Progress bar
  const totalLocs = Object.keys(LOCS).length;
  const pct = Math.min((visited.length / totalLocs) * 100, 100);
  document.getElementById('pts-fill').style.width    = `${pct}%`;
  document.getElementById('pts-bar-txt').textContent = `${visited.length} / ${totalLocs} cursos`;

  // Localidades
  _renderLocations(visited);

  // Ranking
  renderRanking('s-ranking', currentUser.username);
}

// ═══════════════════════════════════════════
// CONTADOR ANIMADO
// ═══════════════════════════════════════════
function _animCounter(id, target) {
  const el  = document.getElementById(id);
  if (!el) return;
  const cur = parseInt(el.textContent) || 0;
  if (cur === target) return;

  const dur   = 650;
  const start = Date.now();
  const diff  = target - cur;

  function step() {
    const p   = Math.min((Date.now() - start) / dur, 1);
    const e   = 1 - Math.pow(1-p, 3);
    el.textContent = Math.round(cur + diff * e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════
// RENDER CURSOS
// ═══════════════════════════════════════════
function _renderLocations(visited = []) {
  const el = document.getElementById('s-locs-grid');
  if (!el) return;

  el.innerHTML = Object.values(LOCS).map(loc => {
    const done = visited.includes(loc.id);
    return `
      <div class="glass-card loc-card ${done ? 'visited' : 'pending'}">
        <div class="loc-icon-big" style="background:${loc.color}22;border-color:${loc.color}44">
          ${loc.icon}
        </div>
        <div class="loc-cname">${loc.name}</div>
        <div>
          ${done
            ? `<span class="badge-v" style="background:${loc.color}22;color:${loc.color}">
                <i class="fas fa-check-circle"></i> Registrado
               </span>`
            : `<span class="badge-p"><i class="fas fa-clock"></i> Pendiente</span>`
          }
        </div>
        ${done ? `<div class="loc-star">⭐ +2 ptos</div>` : ''}
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════
// EFECTO CELEBRACIÓN
// ═══════════════════════════════════════════
function _celebratePts() {
  const el = document.getElementById('s-pts-big');
  if (el) {
    el.classList.add('celebrate');
    setTimeout(() => el.classList.remove('celebrate'), 800);
  }
  playSound('success');
  launchConfetti();
}
