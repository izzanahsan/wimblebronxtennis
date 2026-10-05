// ── HEADER ───────────────────────────────────────────────────
function updateHeader() {
  const s = currentSeason();
  if (!s) return;
  document.getElementById('season-badge').textContent = `${s.name} ▾`;
  document.getElementById('hstat-matches').textContent = seasonMatches(s.id).length;
  document.getElementById('hstat-today').textContent = seasonMatches(s.id).filter(m => m.date === today()).length;
  document.getElementById('header-format').textContent = formatLabel(s.format);
}

// ── NAV ──────────────────────────────────────────────────────
function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (btn) btn.classList.add('active');

  const renders = {
    standings: renderStandings,
    match:     renderMatchSetup,
    history:   renderHistory,
    players:   renderPlayersPage,
    seasons:   renderSeasons
  };
  renders[name] && renders[name]();
}

// ── SEASON SWITCHER ──────────────────────────────────────────
function openSeasonSwitcher() {
  const el = document.getElementById('season-switcher-list');
  el.innerHTML = [...state.seasons].reverse().map(s => `
    <div class="season-switch-row ${s.id === state.currentSeason ? 'active-season' : ''}" onclick="switchSeason(${s.id})">
      <div>
        <div class="season-switch-name">${s.name}${s.id === state.currentSeason ? ' ✓' : ''}</div>
        <div class="season-switch-meta">
          ${formatDate(s.startDate)} – ${formatDate(s.endDate)} ·
          ${seasonMatches(s.id).length} matches ·
          ${getSeasonPlayers(s.id).length} players
        </div>
      </div>
    </div>`).join('');
  openModal('modal-season-switcher');
}

function switchSeason(id) {
  state.currentSeason = id;
  closeModal('modal-season-switcher');
  updateHeader();
  renderStandings();
  renderMatchSetup();
  toast(`Switched to ${currentSeason().name}`);
}
