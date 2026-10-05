// ── PLAYERS PAGE ─────────────────────────────────────────────
function renderPlayersPage() {
  renderPlayers();
  renderAvailability();
}

// ── AVAILABILITY ─────────────────────────────────────────────
function toggleAvailabilityList() {
  const list    = document.getElementById('availability-list');
  const chevron = document.getElementById('avail-dropdown-chevron');
  const open    = list.style.display === 'none';
  list.style.display          = open ? 'block' : 'none';
  chevron.style.transform     = open ? 'rotate(180deg)' : 'rotate(0deg)';
}

function renderAvailability() {
  const el      = document.getElementById('availability-list');
  const countEl = document.getElementById('avail-count');
  if (!el) return;

  const seasonPls = getSeasonPlayers(state.currentSeason);
  if (!seasonPls.length) {
    el.innerHTML = '<div class="empty" style="padding:8px 0">No players in this season.</div>';
    return;
  }

  const n = seasonPls.filter(p => isAvailable(p.id)).length;
  if (countEl) countEl.textContent = `${n}/${seasonPls.length} available`;

  el.innerHTML = seasonPls.map(p => {
    const avail = isAvailable(p.id);
    return `
    <div class="avail-row">
      <div style="opacity:${avail ? 1 : 0.4}">${playerAvatar(p, 30)}</div>
      <div class="avail-name" style="opacity:${avail ? 1 : 0.4}">${p.name}</div>
      <label class="toggle">
        <input type="checkbox" ${avail ? 'checked' : ''} onchange="toggleAvailability(${p.id})">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  }).join('');
}

async function toggleAvailability(id) {
  const newVal = !isAvailable(id);
  state.availability[id] = newVal;
  renderAvailability();
  await sb.from('availability').upsert({ player_id: id, available: newVal }, { onConflict: 'player_id' });
}

// ── ADD PLAYER ───────────────────────────────────────────────
async function addPlayer() {
  const inp  = document.getElementById('new-player-name');
  const name = inp.value.trim();
  if (!name) return;
  if (!state.currentSeason) { toast('⚠️ No active season.'); return; }
  if (state.allPlayers.length >= 16) { toast('Max 16 players'); return; }
  inp.value = '';

  const { data: p, error } = await sb.from('players').insert({ name }).select().single();
  if (error) { toast('❌ Failed to add player'); console.error(error); return; }

  state.allPlayers.push(p);
  state.availability[p.id] = true;

  await sb.from('season_players').insert({ season_id: state.currentSeason, player_id: p.id });
  if (!state.seasonPlayers[state.currentSeason]) state.seasonPlayers[state.currentSeason] = [];
  state.seasonPlayers[state.currentSeason].push(p.id);

  await sb.from('availability').upsert({ player_id: p.id, available: true }, { onConflict: 'player_id' });

  renderPlayersPage();
  renderStandings();
}

// ── REMOVE FROM SEASON ───────────────────────────────────────
let _removePlayerId = null;

function removePlayer(id) {
  const p = state.allPlayers.find(x => x.id === id);
  if (!p) return;
  _removePlayerId = id;
  document.getElementById('modal-remove-player-name').textContent = p.name;
  openModal('modal-remove-player');
}

async function confirmRemovePlayer() {
  if (_removePlayerId === null) return;
  const id = _removePlayerId;
  _removePlayerId = null;
  closeModal('modal-remove-player');

  await sb.from('season_players').delete().eq('season_id', state.currentSeason).eq('player_id', id);
  state.seasonPlayers[state.currentSeason] = (state.seasonPlayers[state.currentSeason] || []).filter(x => x !== id);

  renderPlayersPage();
  renderStandings();
}

// ── DELETE GLOBALLY ──────────────────────────────────────────
let _deletePlayerGlobalId = null;

function deletePlayerGlobal(id) {
  const p = state.allPlayers.find(x => x.id === id);
  if (!p) return;
  _deletePlayerGlobalId = id;
  document.getElementById('modal-delete-player-global-name').textContent = p.name;
  openModal('modal-delete-player-global');
}

async function confirmDeletePlayerGlobal() {
  if (_deletePlayerGlobalId === null) return;
  const id = _deletePlayerGlobalId;
  _deletePlayerGlobalId = null;
  closeModal('modal-delete-player-global');

  await sb.from('players').delete().eq('id', id);
  state.allPlayers = state.allPlayers.filter(p => p.id !== id);
  Object.keys(state.seasonPlayers).forEach(sid => {
    state.seasonPlayers[sid] = state.seasonPlayers[sid].filter(x => x !== id);
  });
  delete state.availability[id];

  renderPlayersPage();
  renderStandings();
  toast('✅ Player deleted globally.');
}

// ── ALL PLAYERS DROPDOWN ─────────────────────────────────────
function togglePlayersList() {
  const list    = document.getElementById('players-list');
  const chevron = document.getElementById('players-dropdown-chevron');
  const open    = list.style.display === 'none';
  list.style.display      = open ? 'block' : 'none';
  chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}

function renderPlayers() {
  const card = document.getElementById('players-dropdown-card');
  const el   = document.getElementById('players-list');
  const players = getSeasonPlayers(state.currentSeason);

  if (!players.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const stats = getPlayerStats(state.currentSeason);

  el.innerHTML = players.map(p => {
    const s = stats.find(x => x.id === p.id) || { pts: 0, matchWins: 0 };
    return `
    <div class="player-chip" style="flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <label style="cursor:pointer;position:relative" title="Tap to change photo">
          ${playerAvatar(p, 36)}
          <input type="file" accept="image/*" style="display:none" onchange="uploadPlayerPhoto(${p.id}, this.files[0])">
          <div style="position:absolute;bottom:-2px;right:-2px;background:var(--purple-light);border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:8px">📷</div>
        </label>
        <div style="flex:1;min-width:0">
          <div class="player-chip-name">${p.name}</div>
          <div class="player-chip-pts">${s.pts}pts · ${s.matchWins}W</div>
        </div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <button onclick="removePlayer(${p.id})" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:10px;padding:3px 6px;cursor:pointer;font-family:'DM Sans',sans-serif">Season</button>
        <button onclick="deletePlayerGlobal(${p.id})" class="remove-btn" title="Delete globally">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ── PHOTO UPLOAD ─────────────────────────────────────────────
async function uploadPlayerPhoto(playerId, file) {
  if (!file) return;

  // Compress to ~60KB using canvas
  const img    = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const MAX    = 400;
  const scale  = Math.min(MAX / img.width, MAX / img.height, 1);
  canvas.width  = img.width  * scale;
  canvas.height = img.height * scale;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.7));

  const path = `player-${playerId}-${Date.now()}.jpg`;
  const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (upErr) { toast('❌ Photo upload failed'); console.error(upErr); return; }

  const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
  const { error: dbErr } = await sb.from('players').update({ photo_url: publicUrl }).eq('id', playerId);
  if (dbErr) { toast('❌ Failed to save photo'); return; }

  const p = state.allPlayers.find(x => x.id === playerId);
  if (p) p.photo_url = publicUrl;

  renderPlayersPage();
  renderStandings();
  toast('✅ Photo updated!');
}
