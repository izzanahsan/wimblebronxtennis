// ── TOAST ────────────────────────────────────────────────────
let _toastTimer = null;
function toast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}

// ── MODAL ────────────────────────────────────────────────────
// One shared modal; content is passed in as HTML
function openSheet(html) {
  document.getElementById('sheet-body').innerHTML = html;
  document.getElementById('sheet').classList.add('open');
}
function closeSheet() { document.getElementById('sheet').classList.remove('open'); }

// ── GENERAL ──────────────────────────────────────────────────
const _escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s)        { return String(s ?? '').replace(/[&<>"']/g, c => _escMap[c]); }
function getColor(i)   { return COLORS[Math.abs(i) % COLORS.length]; }
function initials(n)   { return String(n || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function today()       { return new Date().toLocaleDateString('en-CA'); } // local YYYY-MM-DD
function formatDate(d) {
  if (!d) return '?';
  return new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
function shortName(n, fallback) { return n.length > 16 ? fallback : n; }

async function copyText(text, label = 'Link') {
  try { await navigator.clipboard.writeText(text); toast(`📋 ${label} copied`); }
  catch { prompt('Copy this:', text); }
}

// ── FORMATS ──────────────────────────────────────────────────
// firstto: first side to n games · bo: best of n · total: exactly n games played
function formatLabel(fmt) {
  if (!fmt) return '—';
  if (fmt.type === 'firstto') return `First to ${fmt.n} games`;
  if (fmt.type === 'total')   return `${fmt.n} games total`;
  return `Best of ${fmt.n} (first to ${Math.ceil(fmt.n / 2)})`;
}
function sideMax(fmt) {
  if (fmt.type === 'firstto') return fmt.n;
  if (fmt.type === 'total')   return fmt.n;
  return Math.ceil(fmt.n / 2);
}
function isMatchOver(gA, gB, fmt) {
  if (fmt.type === 'total')   return gA + gB >= fmt.n;
  if (fmt.type === 'firstto') return gA >= fmt.n || gB >= fmt.n;
  const t = Math.ceil(fmt.n / 2);
  return gA >= t || gB >= t || (gA + gB) >= fmt.n;
}

// ── PLAYER AVATAR ────────────────────────────────────────────
function playerAvatar(p, size = 34) {
  if (!p) return '';
  const [bg, fg] = getColor(p.id);
  if (p.photo_url) {
    return `<img src="${esc(p.photo_url)}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.floor(size * 0.38)}px;flex-shrink:0">${esc(initials(p.name))}</div>`;
}
