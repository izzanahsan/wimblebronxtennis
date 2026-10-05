// ── TOAST ────────────────────────────────────────────────────
let _toastTimer = null;
function toast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}

// ── LOADING ──────────────────────────────────────────────────
function setLoading(msg) {
  document.getElementById('loading-msg').textContent = msg || 'Loading...';
  document.getElementById('loading-screen').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
}

// ── MODAL ────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id)  { document.getElementById(id).classList.add('open'); }

// ── GENERAL ──────────────────────────────────────────────────
function getColor(i)   { return COLORS[i % COLORS.length]; }
function initials(n)   { return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function today()       { return new Date().toISOString().split('T')[0]; }
function formatDate(d) {
  if (!d) return '?';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ── FORMAT HELPERS ───────────────────────────────────────────
function getFormat(sid)     { return state.seasons.find(x => x.id === sid)?.format || { type: 'firstto', n: 4 }; }
function formatLabel(fmt)   {
  if (!fmt) return '—';
  if (fmt.type === 'firstto') return `First to ${fmt.n} games`;
  return `Best of ${fmt.n} (first to ${Math.ceil(fmt.n / 2)})`;
}
function winTarget(fmt)     { return fmt.type === 'firstto' ? fmt.n : Math.ceil(fmt.n / 2); }
function isMatchOver(gA, gB, fmt) {
  const t = winTarget(fmt);
  if (fmt.type === 'firstto') return gA >= t || gB >= t;
  return gA >= t || gB >= t || (gA + gB) === fmt.n;
}

// ── PLAYER AVATAR ────────────────────────────────────────────
function playerAvatar(p, size = 34) {
  const idx = state.allPlayers.findIndex(x => x.id === p.id);
  const [bg, fg] = getColor(idx);
  if (p.photo_url) {
    return `<img src="${p.photo_url}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.floor(size * 0.38)}px;flex-shrink:0">${initials(p.name)}</div>`;
}
