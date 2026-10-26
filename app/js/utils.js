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
// One shared modal; content is passed in as HTML.
// Focus moves into the sheet and returns to where it was on close.
let _sheetReturn = null, _confirmResolve = null;
function openSheet(html) {
  const sheet = document.getElementById('sheet');
  const wasOpen = sheet.classList.contains('open');
  if (!wasOpen) _sheetReturn = document.activeElement;
  if (_confirmResolve) { const r = _confirmResolve; _confirmResolve = null; r(false); }
  document.getElementById('sheet-body').innerHTML = html;
  const title = sheet.querySelector('.modal-title');
  const modal = sheet.querySelector('.modal');
  if (title) { title.id = 'sheet-title'; modal.setAttribute('aria-labelledby', 'sheet-title'); }
  else modal.removeAttribute('aria-labelledby');
  sheet.classList.add('open');
  if (!wasOpen) modal.focus({ preventScroll: true });
}
function closeSheet() {
  const sheet = document.getElementById('sheet');
  if (!sheet.classList.contains('open')) return;
  sheet.classList.remove('open');
  if (_confirmResolve) { const r = _confirmResolve; _confirmResolve = null; r(false); }
  _sheetReturn?.focus?.({ preventScroll: true });
  _sheetReturn = null;
}

// In-app confirm: resolves true only when the action button is tapped
function confirmSheet({ title, body = '', action, danger = false }) {
  return new Promise(res => {
    openSheet(`
      <div class="modal-title">${esc(title)}</div>
      ${body ? `<p class="confirm-body">${body}</p>` : ''}
      <div class="confirm-actions">
        <button class="btn btn-outline" onclick="closeSheet()">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-green'}" onclick="_confirmOk()">${esc(action)}</button>
      </div>`);
    _confirmResolve = res;
  });
}
function _confirmOk() {
  const r = _confirmResolve; _confirmResolve = null;
  closeSheet();
  r?.(true);
}

// Rows marked role="button" act like buttons from the keyboard too
document.addEventListener('keydown', e => {
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.getAttribute?.('role') === 'button' && t.tagName !== 'BUTTON') {
    e.preventDefault(); t.click();
  }
});

// ── ICONS ────────────────────────────────────────────────────
// Inline SVG line icons; they inherit currentColor
const _svg = (d, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  day:    s => _svg('<path d="M21 12a9 9 0 0 1-15.4 6.4"/><path d="M3 12a9 9 0 0 1 15.4-6.4"/><path d="M18.5 2.5v4h-4"/><path d="M5.5 21.5v-4h4"/>', s),
  league: s => _svg('<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>', s),
  share:  s => _svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>', s),
  chev:   s => _svg('<path d="m9 6 6 6-6 6"/>', s),
  stats:  s => _svg('<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>', s),
  trash:  s => _svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>', s),
  shuffle:s => _svg('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>', s)
};

// Rank labels where ties share a number (1, 1, 3). same(a, b) says two rows tie.
function tiedRanks(rows, same) {
  const out = [];
  rows.forEach((r, i) => out.push(i > 0 && same(rows[i - 1], r) ? out[i - 1] : i + 1));
  return out;
}

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
  return `<div aria-hidden="true" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.floor(size * 0.38)}px;flex-shrink:0">${esc(initials(p.name))}</div>`;
}
