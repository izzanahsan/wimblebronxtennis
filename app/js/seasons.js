// ── SEASONS LIST ─────────────────────────────────────────────
function renderSeasons() {
  const el = document.getElementById('seasons-list');
  if (!state.seasons.length) {
    el.innerHTML = '<div class="empty">No seasons yet.</div>';
    return;
  }

  el.innerHTML = [...state.seasons].reverse().map(s => `
    <div class="season-row">
      <div class="season-num" onclick="switchSeason(${s.id})" title="Switch to this season">${s.id}</div>
      <div class="season-info-block">
        <div class="season-name">
          ${s.name}
          ${s.id === state.currentSeason ? '<span style="color:var(--green-light);font-size:11px"> ● Active</span>' : ''}
        </div>
        <div class="season-dates">${formatDate(s.startDate)} – ${formatDate(s.endDate)}</div>
        <div class="season-fmt">${formatLabel(s.format)}</div>
        <div class="season-fmt">${getSeasonPlayers(s.id).length} players</div>
        ${s.winner
          ? `<div class="season-winner">🏆 ${s.winner}</div>`
          : `<div class="text-sm text-muted">In progress</div>`}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="text-sm text-muted">${seasonMatches(s.id).length} matches</div>
        <button onclick="deleteSeason(${s.id})" style="background:none;border:1px solid #7F1D1D;border-radius:6px;color:#FCA5A5;font-size:11px;padding:3px 8px;cursor:pointer;font-family:'DM Sans',sans-serif">🗑 Delete</button>
      </div>
    </div>`).join('');
}

// ── DELETE SEASON ────────────────────────────────────────────
let _deleteSeasonId = null;

function deleteSeason(id) {
  if (state.seasons.length === 1) { toast('⚠️ Cannot delete the only season.'); return; }
  const s = state.seasons.find(x => x.id === id);
  if (!s) return;
  _deleteSeasonId = id;
  document.getElementById('modal-delete-season-desc').textContent = `"${s.name}" · ${seasonMatches(id).length} match(es)`;
  openModal('modal-delete-season');
}

async function confirmDeleteSeason() {
  if (_deleteSeasonId === null) return;
  const id = _deleteSeasonId;
  _deleteSeasonId = null;
  closeModal('modal-delete-season');

  await sb.from('seasons').delete().eq('id', id); // cascades to matches
  state.seasons = state.seasons.filter(x => x.id !== id);
  state.matches = state.matches.filter(m => m.seasonId !== id);
  delete state.seasonPlayers[id];

  if (state.currentSeason === id) {
    state.currentSeason = state.seasons[state.seasons.length - 1]?.id || null;
  }

  renderSeasons();
  updateHeader();
  renderStandings();
}

// ── NEW SEASON ───────────────────────────────────────────────
let modalFmt = { type: 'firstto', n: 4 };
let nsSelectedPlayers = new Set();

function buildNPicker(cid, opts, sel, fn) {
  document.getElementById(cid).innerHTML = opts
    .map(n => `<div class="n-opt ${n === sel ? 'active' : ''}" onclick="${fn}(${n})">${n}</div>`)
    .join('');
}

function setFormatType(type) {
  modalFmt.type = type;
  modalFmt.n    = type === 'firstto' ? 4 : 7;
  document.getElementById('firstto-picker').style.display = type === 'firstto' ? '' : 'none';
  document.getElementById('bo-picker').style.display      = type === 'bo'      ? '' : 'none';
  document.getElementById('fmt-btn-firstto').classList.toggle('active', type === 'firstto');
  document.getElementById('fmt-btn-bo').classList.toggle('active',      type === 'bo');
  refreshPickers();
  updateFormatPreview();
}

function pickFirstToN(n) { modalFmt.n = n; refreshPickers(); updateFormatPreview(); }
function pickBoN(n)      { modalFmt.n = n; refreshPickers(); updateFormatPreview(); }

function refreshPickers() {
  buildNPicker('firstto-n-picker', FIRSTTO_OPTS, modalFmt.type === 'firstto' ? modalFmt.n : 4, 'pickFirstToN');
  buildNPicker('bo-n-picker',      BO_OPTS,      modalFmt.type === 'bo'      ? modalFmt.n : 7, 'pickBoN');
}

function updateFormatPreview() {
  const t = winTarget(modalFmt);
  document.getElementById('format-preview').innerHTML =
    `<strong>${formatLabel(modalFmt)}</strong> — win by reaching <strong>${t} games</strong>` +
    (modalFmt.type === 'bo' ? ` (max ${modalFmt.n} games)` : '');
}

function toggleNsPlayer(id) {
  if (nsSelectedPlayers.has(id)) nsSelectedPlayers.delete(id);
  else                            nsSelectedPlayers.add(id);
  renderNsChecklist();
}

function renderNsChecklist() {
  const el = document.getElementById('ns-player-checklist');
  if (!state.allPlayers.length) {
    el.innerHTML = '<div class="empty" style="padding:8px 0">No players yet — add them after creating the season.</div>';
    return;
  }
  el.innerHTML = state.allPlayers.map((p, i) => {
    const [bg, fg] = getColor(i);
    const checked  = nsSelectedPlayers.has(p.id);
    return `
    <div class="player-check-row">
      <div style="width:28px;height:28px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${initials(p.name)}</div>
      <div class="player-check-name">${p.name}</div>
      <button onclick="deletePlayerGlobal(${p.id});closeModal('modal-new-season')"
        style="background:none;border:none;color:#EF4444;font-size:16px;cursor:pointer;padding:2px 6px;line-height:1"
        title="Delete player globally">🗑</button>
      <label class="toggle">
        <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleNsPlayer(${p.id})">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  }).join('');
}

function openNewSeasonModal() {
  modalFmt          = { type: 'firstto', n: 4 };
  nsSelectedPlayers = new Set(state.allPlayers.map(p => p.id)); // default: all selected

  const now = new Date(), end = new Date(now);
  end.setMonth(end.getMonth() + 3);

  document.getElementById('ns-name').value  = '';
  document.getElementById('ns-start').value = today();
  document.getElementById('ns-end').value   = end.toISOString().split('T')[0];

  setFormatType('firstto');
  renderNsChecklist();
  openModal('modal-new-season');
}

async function startNewSeason() {
  const startDate = document.getElementById('ns-start').value;
  const endDate   = document.getElementById('ns-end').value;
  if (!startDate || !endDate)  { toast('⚠️ Set start and end dates.'); return; }
  if (endDate <= startDate)    { toast('⚠️ End date must be after start date.'); return; }

  const cn = document.getElementById('ns-name').value.trim();

  // Mark winner on current season
  if (state.currentSeason) {
    const stats  = getPlayerStats(state.currentSeason);
    const winner = stats.length ? stats[0].name : null;
    if (winner) {
      await sb.from('seasons').update({ winner }).eq('id', state.currentSeason);
      const curr = currentSeason();
      if (curr) curr.winner = winner;
    }
  }

  const newName = cn || (state.seasons.length > 0 ? `Season ${state.seasons.length + 1}` : 'Season 1');

  const { data, error } = await sb.from('seasons')
    .insert({
      name:       newName,
      start_date: startDate,
      end_date:   endDate,
      winner:     null,
      format:     JSON.parse(JSON.stringify(modalFmt))
    })
    .select().single();

  if (error) {
    const msg = error?.message || error?.details || JSON.stringify(error);
    toast('❌ ' + msg, 6000);
    console.error('Season insert error:', error);
    return;
  }

  state.seasons.push({
    id: data.id, name: data.name,
    startDate: data.start_date, endDate: data.end_date,
    winner: null, format: data.format
  });
  state.seasonPlayers[data.id] = [];

  // Add selected players to new season
  const selectedIds = [...nsSelectedPlayers];
  if (selectedIds.length) {
    const rows = selectedIds.map(pid => ({ season_id: data.id, player_id: pid }));
    await sb.from('season_players').insert(rows);
    state.seasonPlayers[data.id] = selectedIds;
  }

  state.currentSeason = data.id;
  closeModal('modal-new-season');
  renderSeasons();
  updateHeader();
  renderStandings();
  toast(`✅ ${data.name} started!`);
}
