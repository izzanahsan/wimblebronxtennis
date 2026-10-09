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

// ── ICONS ────────────────────────────────────────────────────
// Inline SVG line icons; they inherit currentColor
const _svg = (d, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  day:    s => _svg('<path d="M21 12a9 9 0 0 1-15.4 6.4"/><path d="M3 12a9 9 0 0 1 15.4-6.4"/><path d="M18.5 2.5v4h-4"/><path d="M5.5 21.5v-4h4"/>', s),
  league: s => _svg('<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>', s),
  share:  s => _svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>', s),
  chev:   s => _svg('<path d="m9 6 6 6-6 6"/>', s)
};

// The club badge, used wherever the brand appears
function logoImg(size, cls = '') {
  return `<img src="icon-192.png" alt="Wimblebronx" width="${size}" height="${size}" class="${cls}">`;
}

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
