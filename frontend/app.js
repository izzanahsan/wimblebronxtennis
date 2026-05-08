const API_URL = '';

// Firebase initialization placeholder
const firebaseConfig = {
  apiKey: "AIzaSyD5nuMuXUttZNwzm6u4v8sX4ez6yrXr5dE",
  authDomain: "sandbox-dce.firebaseapp.com",
  projectId: "sandbox-dce",
  storageBucket: "sandbox-dce.firebasestorage.app",
  messagingSenderId: "403974804730",
  appId: "1:403974804730:web:e3e149707d5985e3556543",
  measurementId: "G-1K0LC6JD2C"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── TOAST ────────────────────────────────────────────────────
let _toastTimer = null;
function toast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}
function setLoading(msg) { document.getElementById('loading-msg').textContent = msg || 'Loading...'; document.getElementById('loading-screen').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-screen').style.display = 'none'; }

// ── UTILS ────────────────────────────────────────────────────
const COLORS = [['#6B21A8', '#E9D5FF'], ['#16A34A', '#BBF7D0'], ['#DC2626', '#FECACA'], ['#D97706', '#FDE68A'], ['#0891B2', '#A5F3FC'], ['#7C3AED', '#DDD6FE'], ['#B45309', '#FDE68A'], ['#0F766E', '#99F6E4'], ['#BE185D', '#FBCFE8'], ['#1D4ED8', '#BFDBFE'], ['#4D7C0F', '#D9F99D'], ['#9D174D', '#FBCFE8'], ['#78716C', '#E7E5E0']];
function getColor(i) { return COLORS[i % COLORS.length] }
function initials(n) { return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }
function today() { return new Date().toISOString().split('T')[0] }
function formatDate(d) { if (!d) return '?'; return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) }
function closeModal(id) { document.getElementById(id).classList.remove('open') }
function openModal(id) { document.getElementById(id).classList.add('open') }

// ── STATE ────────────────────────────────────────────────────
let state = {
  seasons: [],       // [{id, name, startDate, endDate, winner, format}]
  allPlayers: [],    // [{id, name, photo}] — master list
  seasonPlayers: {}, // {seasonId: [playerId, ...]}
  matches: [],       // [{id, seasonId, date, teamA, teamB, gamesA, gamesB, winner, format}]
  availability: {},  // {playerId: bool}
  lockedDates: [],
  currentSeason: null
};

// ── LOAD ─────────────────────────────────────────────────────
async function loadAll() {
  setLoading('Connecting...');
  try {
    const [seasons, players, matches, locked, avail] = await Promise.all([
      fetch(`${API_URL}/seasons/`).then(r => r.json()),
      fetch(`${API_URL}/players/`).then(r => r.json()),
      fetch(`${API_URL}/matches/`).then(r => r.json()),
      fetch(`${API_URL}/matches/locked-dates`).then(r => r.json()),
      fetch(`${API_URL}/players/availability`).then(r => r.json()),
    ]);
    
    state.seasons = seasons;
    state.allPlayers = players;
    
    state.seasonPlayers = {};
    seasons.forEach(s => {
      state.seasonPlayers[s.id] = s.playerIds || [];
    });
    
    state.matches = matches;
    state.lockedDates = locked;
    state.availability = avail;
    
    if (state.seasons.length) state.currentSeason = state.seasons[state.seasons.length - 1].id;
    hideLoading();
    setupLiveListener(state.currentSeason);
  } catch (e) {
    toast('❌ Failed to load data. Check connection.');
    console.error(e);
  }
}

// ── SEASON HELPERS ───────────────────────────────────────────
function currentSeason() { return state.seasons.find(s => s.id === state.currentSeason) }
function seasonMatches(sid) { return state.matches.filter(m => m.seasonId === sid) }
function getSeasonPlayers(sid) {
  const ids = state.seasonPlayers[sid] || [];
  return state.allPlayers.filter(p => ids.includes(p.id));
}
function isAvailable(id) { return state.availability[id] !== false }
function isDateLocked(d) { return state.lockedDates.includes(d) }

// ── FORMAT HELPERS ───────────────────────────────────────────
function getFormat(sid) { return state.seasons.find(x => x.id === sid)?.format || { type: 'firstto', n: 4 } }
function formatLabel(fmt) { if (!fmt) return '—'; if (fmt.type === 'firstto') return `First to ${fmt.n} games`; return `Best of ${fmt.n} (first to ${Math.ceil(fmt.n / 2)})` }
function winTarget(fmt) { return fmt.type === 'firstto' ? fmt.n : Math.ceil(fmt.n / 2) }
function isMatchOver(gA, gB, fmt) { const t = winTarget(fmt); if (fmt.type === 'firstto') return gA >= t || gB >= t; return gA >= t || gB >= t || (gA + gB) === fmt.n }

// ── STATS ────────────────────────────────────────────────────
function getPlayerStats(sid) {
  const matches = seasonMatches(sid);
  const players = getSeasonPlayers(sid);
  return players.map(p => {
    let pts = 0, matchWins = 0, played = 0, gamesWon = 0, gamesLost = 0;
    const matchResults = [];
    matches.forEach(m => {
      const inA = m.teamA.includes(p.id), inB = m.teamB.includes(p.id);
      if (!inA && !inB) return;
      played++;
      if (m.winner === 'A' && inA) { pts += 3; matchWins++; gamesWon += m.gamesA; gamesLost += m.gamesB; matchResults.push(true); }
      else if (m.winner === 'B' && inB) { pts += 3; matchWins++; gamesWon += m.gamesB; gamesLost += m.gamesA; matchResults.push(true); }
      else if (inA) { pts += 1; gamesWon += m.gamesA; gamesLost += m.gamesB; matchResults.push(false); }
      else { pts += 1; gamesWon += m.gamesB; gamesLost += m.gamesA; matchResults.push(false); }
    });
    return { ...p, pts, matchWins, played, gamesWon, gamesLost, gameDiff: gamesWon - gamesLost, last5: matchResults.slice(-5) };
  }).sort((a, b) => b.pts - a.pts || b.matchWins - a.matchWins || b.gameDiff - a.gameDiff || b.gamesWon - a.gamesWon);
}

// ── HEADER ───────────────────────────────────────────────────
function updateHeader() {
  const s = currentSeason(); if (!s) return;
  document.getElementById('season-badge').textContent = `${s.name} ▾`;
  document.getElementById('hstat-matches').textContent = seasonMatches(s.id).length;
  document.getElementById('hstat-today').textContent = seasonMatches(s.id).filter(m => m.date === today()).length;
  document.getElementById('header-format').textContent = formatLabel(s.format);
}

// ── SEASON SWITCHER ──────────────────────────────────────────
function openSeasonSwitcher() {
  const el = document.getElementById('season-switcher-list');
  el.innerHTML = [...state.seasons].reverse().map(s => `
<div class="season-switch-row ${s.id === state.currentSeason ? 'active-season' : ''}" onclick="switchSeason('${s.id}')">
  <div>
    <div class="season-switch-name">${s.name}${s.id === state.currentSeason ? ' ✓' : ''}</div>
    <div class="season-switch-meta">${formatDate(s.startDate)} – ${formatDate(s.endDate)} · ${seasonMatches(s.id).length} matches · ${getSeasonPlayers(s.id).length} players</div>
  </div>
</div>`).join('');
  openModal('modal-season-switcher');
}
function switchSeason(id) {
  state.currentSeason = id;
  closeModal('modal-season-switcher');
  updateHeader(); renderStandings(); renderMatchSetup();
  toast(`Switched to ${currentSeason().name}`);
  setupLiveListener(id);
}

// ── NAV ──────────────────────────────────────────────────────
function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  const renders = { standings: renderStandings, match: renderMatchSetup, history: renderHistory, players: renderPlayersPage, seasons: renderSeasons };
  renders[name] && renders[name]();
}

// ── STANDINGS ────────────────────────────────────────────────
function renderStandings() {
  updateHeader();
  const stats = getPlayerStats(state.currentSeason);
  const el = document.getElementById('leaderboard-list');
  if (!stats.length) { el.innerHTML = '<div class="empty">No players in this season yet.</div>'; return; }
  el.innerHTML = stats.map((p, i) => {
    const rc = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
    const dots = Array.from({ length: 5 }, (_, j) => {
      if (j >= p.last5.length) return `<div class="win-dot"></div>`;
      return p.last5[j]
        ? `<div class="win-dot" style="background:#16A34A;border-color:#16A34A"></div>`
        : `<div class="win-dot" style="background:#DC2626;border-color:#DC2626"></div>`;
    }).join('');
    const diffStr = p.gameDiff > 0 ? `+${p.gameDiff}` : p.gameDiff === 0 ? '±0' : `${p.gameDiff}`;
    const diffColor = p.gameDiff > 0 ? 'var(--green-light)' : p.gameDiff < 0 ? '#FCA5A5' : 'var(--text-muted)';
    return `<div class="lb-row">
  <div class="lb-rank ${rc}">${i + 1}</div>
  ${playerAvatar(p, 34)}
  <div class="lb-info">
    <div class="lb-name">${p.name}</div>
    <div class="wins-bar">${dots}</div>
    <div class="lb-sub">${p.matchWins}W · ${p.played} played · <span style="color:${diffColor};font-weight:600">${diffStr}</span></div>
  </div>
  <div class="lb-pts">${p.pts}</div>
</div>`;
  }).join('');
}

// ── PLAYERS ──────────────────────────────────────────────────
function renderPlayersPage() { renderPlayers(); renderAvailability(); }

function toggleAvailabilityList() {
  const list = document.getElementById('availability-list');
  const chevron = document.getElementById('avail-dropdown-chevron');
  const open = list.style.display === 'none';
  list.style.display = open ? 'block' : 'none';
  chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}

function renderAvailability() {
  const el = document.getElementById('availability-list');
  const countEl = document.getElementById('avail-count');
  if (!el) return;
  const seasonPls = getSeasonPlayers(state.currentSeason);
  if (!seasonPls.length) { el.innerHTML = '<div class="empty" style="padding:8px 0">No players in this season.</div>'; return; }
  const n = seasonPls.filter(p => isAvailable(p.id)).length;
  if (countEl) countEl.textContent = `${n}/${seasonPls.length} available`;
  el.innerHTML = seasonPls.map((p, i) => {
    const avail = isAvailable(p.id);
    return `<div class="avail-row">
  <div style="opacity:${avail ? 1 : 0.4}">${playerAvatar(p, 30)}</div>
  <div class="avail-name" style="opacity:${avail ? 1 : 0.4}">${p.name}</div>
  <label class="toggle"><input type="checkbox" ${avail ? 'checked' : ''} onchange="toggleAvailability('${p.id}')"><span class="toggle-slider"></span></label>
</div>`;
  }).join('');
}

async function toggleAvailability(id) {
  const newVal = !isAvailable(id);
  state.availability[id] = newVal;
  renderAvailability();
  await fetch(`${API_URL}/players/availability/${id}?available=${newVal}`, { method: 'PUT' });
}

async function addPlayer() {
  const inp = document.getElementById('new-player-name');
  const name = inp.value.trim();
  if (!name) return;
  if (!state.currentSeason) { toast('⚠️ No active season.'); return; }
  inp.value = '';
  
  const p = await fetch(`${API_URL}/players/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  }).then(r => r.json());
  
  await fetch(`${API_URL}/seasons/${state.currentSeason}/players/${p.id}`, { method: 'POST' });
  
  state.allPlayers.push(p);
  state.availability[p.id] = true;
  if (!state.seasonPlayers[state.currentSeason]) state.seasonPlayers[state.currentSeason] = [];
  state.seasonPlayers[state.currentSeason].push(p.id);
  
  renderPlayersPage(); renderStandings();
}

let _deletePlayerGlobalId = null;
function deletePlayerGlobal(id) {
  const p = state.allPlayers.find(x => x.id === id); if (!p) return;
  _deletePlayerGlobalId = id;
  document.getElementById('modal-delete-player-global-name').textContent = p.name;
  openModal('modal-delete-player-global');
}
async function confirmDeletePlayerGlobal() {
  if (_deletePlayerGlobalId === null) return;
  const id = _deletePlayerGlobalId; _deletePlayerGlobalId = null;
  closeModal('modal-delete-player-global');
  
  await fetch(`${API_URL}/players/${id}`, { method: 'DELETE' });
  
  state.allPlayers = state.allPlayers.filter(p => p.id !== id);
  Object.keys(state.seasonPlayers).forEach(sid => {
    state.seasonPlayers[sid] = state.seasonPlayers[sid].filter(x => x !== id);
  });
  delete state.availability[id];
  renderPlayersPage(); renderStandings();
  toast(`✅ Player deleted globally.`);
}

function removePlayer(id) {
  const p = state.allPlayers.find(x => x.id === id); if (!p) return;
  _removePlayerId = id;
  document.getElementById('modal-remove-player-name').textContent = p.name;
  openModal('modal-remove-player');
}
let _removePlayerId = null;
async function confirmRemovePlayer() {
  if (_removePlayerId === null) return;
  const id = _removePlayerId; _removePlayerId = null;
  closeModal('modal-remove-player');
  
  await fetch(`${API_URL}/seasons/${state.currentSeason}/players/${id}`, { method: 'DELETE' });
  
  state.seasonPlayers[state.currentSeason] = (state.seasonPlayers[state.currentSeason] || []).filter(x => x !== id);
  renderPlayersPage(); renderStandings();
}

function togglePlayersList() {
  const list = document.getElementById('players-list');
  const chevron = document.getElementById('players-dropdown-chevron');
  const open = list.style.display === 'none';
  list.style.display = open ? 'block' : 'none';
  chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}
function renderPlayers() {
  const card = document.getElementById('players-dropdown-card');
  const el = document.getElementById('players-list');
  const players = getSeasonPlayers(state.currentSeason);
  if (!players.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const stats = getPlayerStats(state.currentSeason);
  el.innerHTML = players.map(p => {
    const s = stats.find(x => x.id === p.id) || { pts: 0, matchWins: 0 };
    return `<div class="player-chip" style="flex-wrap:wrap;gap:8px">
  <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
    <label style="cursor:pointer;position:relative" title="Tap to change photo">
      ${playerAvatar(p, 36)}
      <input type="file" accept="image/*" style="display:none" onchange="uploadPlayerPhoto('${p.id}',this.files[0])">
      <div style="position:absolute;bottom:-2px;right:-2px;background:var(--purple-light);border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:8px">📷</div>
    </label>
    <div style="flex:1;min-width:0">
      <div class="player-chip-name">${p.name}</div>
      <div class="player-chip-pts">${s.pts}pts · ${s.matchWins}W</div>
    </div>
  </div>
  <div style="display:flex;gap:4px;align-items:center">
    <button onclick="removePlayer('${p.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:10px;padding:3px 6px;cursor:pointer;font-family:'DM Sans',sans-serif">Season</button>
    <button onclick="deletePlayerGlobal('${p.id}')" class="remove-btn" title="Delete globally">🗑</button>
  </div>
</div>`;
  }).join('');
}

// ── MATCH SETUP ──────────────────────────────────────────────
let selA = [], selB = [], scoreA = 0, scoreB = 0;

function renderMatchSetup() {
  if (loadLive()) {
    scoreMode = 'quick';
    renderTeamSelectors('✅ Resuming match...');
    document.getElementById('score-section').style.display = 'block';
    setScoreMode('live');
    toast('⚡ Resuming in-progress match');
    return;
  }
  selA = []; selB = []; scoreA = 0; scoreB = 0;
  scoreMode = 'quick';
  resetLive();
  document.getElementById('quick-mode').style.display = 'block';
  document.getElementById('live-mode').style.display = 'none';
  document.getElementById('mode-quick-btn').classList.add('active');
  document.getElementById('mode-live-btn').classList.remove('active');
  renderTeamSelectors(null);
  document.getElementById('score-section').style.display = 'none';
}
function renderTeamSelectors(hintOverride) {
  const players = getSeasonPlayers(state.currentSeason);
  ['a', 'b'].forEach(t => {
    const el = document.getElementById('team-' + t + '-select');
    if (!players.length) { el.innerHTML = '<div class="text-sm text-muted">No players in this season.</div>'; return; }
    el.innerHTML = players.map(p => {
      const inA = selA.includes(p.id), inB = selB.includes(p.id);
      const cls = inA ? 'sel-a' : inB ? 'sel-b' : '';
      const extra = (t === 'a' && inB) || (t === 'b' && inA) ? 'disabled' : !isAvailable(p.id) ? 'unavail' : '';
      return `<div class="p-tag ${cls} ${extra}" onclick="togglePlayer('${p.id}','${t}')">${p.name}</div>`;
    }).join('');
  });
  const ready = selA.length === 2 && selB.length === 2;
  if (hintOverride !== null) {
    document.getElementById('team-selection-hint').textContent = hintOverride;
  } else if (!ready) {
    document.getElementById('team-selection-hint').textContent = `Team A: ${selA.length}/2  |  Team B: ${selB.length}/2`;
  }
  if (ready) {
    scoreA = 0; scoreB = 0;
    const na = selA.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
    const nb = selB.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
    document.getElementById('score-label-a').textContent = na.length > 18 ? 'TEAM A' : na;
    document.getElementById('score-label-b').textContent = nb.length > 18 ? 'TEAM B' : nb;
    document.getElementById('score-target-hint').textContent = formatLabel(getFormat(state.currentSeason));
    updateScoreDisplay();
    document.getElementById('score-section').style.display = 'block';
  } else {
    document.getElementById('score-section').style.display = 'none';
  }
}
function togglePlayer(id, team) {
  if (team === 'a') { if (selA.includes(id)) selA = selA.filter(x => x !== id); else if (selA.length < 2) selA.push(id); }
  else { if (selB.includes(id)) selB = selB.filter(x => x !== id); else if (selB.length < 2) selB.push(id); }
  renderTeamSelectors(null);
}

// ── RANDOMIZER ───────────────────────────────────────────────
function getPastPairs(sid) {
  const pairs = new Set();
  seasonMatches(sid).forEach(m => {
    if (m.teamA.length === 2) pairs.add([...m.teamA].sort().join('-'));
    if (m.teamB.length === 2) pairs.add([...m.teamB].sort().join('-'));
  });
  return pairs;
}
function pairKey(a, b) { return [a, b].sort().join('-') }
function countPairRepeats(combo, pairs) {
  let r = 0;
  if (pairs.has(pairKey(combo[0], combo[1]))) r++;
  if (pairs.has(pairKey(combo[2], combo[3]))) r++;
  return r;
}
function getMatchesTodayCount(playerId) {
  return seasonMatches(state.currentSeason).filter(m => m.date === today() && (m.teamA.includes(playerId) || m.teamB.includes(playerId))).length;
}
function getSeasonMatchCount(playerId) {
  return seasonMatches(state.currentSeason).filter(m => m.teamA.includes(playerId) || m.teamB.includes(playerId)).length;
}
function randomizeTeams() {
  const avail = getSeasonPlayers(state.currentSeason).filter(p => isAvailable(p.id));
  if (avail.length < 4) {
    document.getElementById('team-selection-hint').textContent = `⚠️ Need 4+ available players (${avail.length} available).`;
    return;
  }
  const pastPairs = getPastPairs(state.currentSeason);
  const sorted = [...avail].sort((a, b) => {
    const todayDiff = getMatchesTodayCount(a.id) - getMatchesTodayCount(b.id);
    if (todayDiff !== 0) return todayDiff;
    const seasonDiff = getSeasonMatchCount(a.id) - getSeasonMatchCount(b.id);
    if (seasonDiff !== 0) return seasonDiff;
    return Math.random() - 0.5;
  });
  const pool = sorted.slice(0, 4);
  const minToday = getMatchesTodayCount(pool[3].id);
  const fallback = getMatchesTodayCount(pool[0].id) > 0;
  const ids = pool.map(p => p.id);
  const splits = [[ids[0], ids[1], ids[2], ids[3]], [ids[0], ids[2], ids[1], ids[3]], [ids[0], ids[3], ids[1], ids[2]]];
  splits.sort((a, b) => countPairRepeats(a, pastPairs) - countPairRepeats(b, pastPairs));
  const best = splits[0];
  const repeats = countPairRepeats(best, pastPairs);
  selA = [best[0], best[1]]; selB = [best[2], best[3]];
  let hint = '✅ Teams ready!';
  if (fallback) hint = `⚠️ Everyone played today — picking least played (${minToday} match${minToday > 1 ? 'es' : ''} today).`;
  else if (repeats === 2) hint = '⚠️ All pairs have played together before.';
  else if (repeats === 1) hint = '⚠️ One pair has played together before — best available.';
  renderTeamSelectors(hint);
}

// ── SCORE MODE ───────────────────────────────────────────────
let scoreMode = 'quick';

function setScoreMode(mode) {
  scoreMode = mode;
  document.getElementById('quick-mode').style.display = mode === 'quick' ? 'block' : 'none';
  document.getElementById('live-mode').style.display = mode === 'live' ? 'block' : 'none';
  document.getElementById('mode-quick-btn').classList.toggle('active', mode === 'quick');
  document.getElementById('mode-live-btn').classList.toggle('active', mode === 'live');
  if (mode === 'live') renderLiveScore();
}

// ── LIVE SCORER STATE ────────────────────────────────────────
const PT_LABELS = ['0', '15', '30', '40', 'AD', 'Game'];
let live = {
  gamesA: 0, gamesB: 0,
  ptA: 0, ptB: 0,
  deuceRule: 'sudden',
  serve: 'a',
  history: [],
  matchOver: false
};

const LIVE_STORE = 'wimblebronx_live';
function saveLive() {
  const data = { live, selA, selB, seasonId: state.currentSeason };
  localStorage.setItem(LIVE_STORE, JSON.stringify(data));
  if (state.currentSeason) {
    db.collection("live_matches").doc(state.currentSeason).set(data)
      .catch(e => console.error("Error saving live match:", e));
  }
}
function loadLive() {
  if (selA && selA.length === 2 && selB && selB.length === 2 && live && !live.matchOver) {
    return true;
  }
  try {
    const d = JSON.parse(localStorage.getItem(LIVE_STORE) || 'null');
    if (d && d.seasonId === state.currentSeason && d.selA && d.selB) {
      live = d.live;
      selA = d.selA; selB = d.selB;
      return true;
    }
  } catch { }
  return false;
}
function clearLive() {
  localStorage.removeItem(LIVE_STORE);
}

function setServe(team) {
  live.serve = team;
  document.getElementById('serve-a-btn').classList.toggle('active', team === 'a');
  document.getElementById('serve-b-btn').classList.toggle('active', team === 'b');
  saveLive(); renderLiveScore();
}

function setDeuceRule(rule) {
  live.deuceRule = rule;
  document.getElementById('deuce-sudden-btn').classList.toggle('active', rule === 'sudden');
  document.getElementById('deuce-full-btn').classList.toggle('active', rule === 'full');
  saveLive(); renderLiveScore();
}

function resetLive() {
  live = { gamesA: 0, gamesB: 0, ptA: 0, ptB: 0, deuceRule: live.deuceRule || 'sudden', serve: live.serve || 'a', history: [], matchOver: false };
}

function livePoint(team) {
  if (live.matchOver) return;
  live.history.push({ ptA: live.ptA, ptB: live.ptB, gamesA: live.gamesA, gamesB: live.gamesB, matchOver: false });

  if (team === 'a') live.ptA++;
  else live.ptB++;

  const gameWon = checkGameEnd();
  if (gameWon) {
    if (gameWon === 'a') live.gamesA++;
    else live.gamesB++;
    live.ptA = 0; live.ptB = 0;
    
    // Switch serve automatically
    live.serve = live.serve === 'a' ? 'b' : 'a';
    
    const fmt = getFormat(state.currentSeason);
    if (isMatchOver(live.gamesA, live.gamesB, fmt)) {
      live.matchOver = true;
      saveLive();
      renderLiveScore();
      setTimeout(() => autoSaveLiveMatch(), 800);
      return;
    }
  }
  saveLive();
  renderLiveScore();
}

function checkGameEnd() {
  const a = live.ptA, b = live.ptB;
  if (live.deuceRule === 'sudden') {
    if (a >= 3 && b >= 3) return a > b ? 'a' : 'b';
    if (a >= 4) return 'a';
    if (b >= 4) return 'b';
  } else {
    if (a >= 3 && b >= 3) {
      if (a - b >= 2) return 'a';
      if (b - a >= 2) return 'b';
      return null;
    }
    if (a >= 4) return 'a';
    if (b >= 4) return 'b';
  }
  return null;
}

function getPointLabel(ptA, ptB) {
  const a = ptA, b = ptB;
  if (live.deuceRule === 'sudden') {
    if (a >= 3 && b >= 3) return { a: '40', b: '40', status: 'Sudden Death — next point wins!' };
    return { a: PT_LABELS[Math.min(a, 3)], b: PT_LABELS[Math.min(b, 3)], status: '' };
  } else {
    if (a >= 3 && b >= 3) {
      if (a === b) return { a: '40', b: '40', status: 'Deuce' };
      if (a > b) return { a: 'AD', b: '—', status: 'Advantage Team A' };
      return { a: '—', b: 'AD', status: 'Advantage Team B' };
    }
    return { a: PT_LABELS[Math.min(a, 3)], b: PT_LABELS[Math.min(b, 3)], status: '' };
  }
}

function undoLastPoint() {
  if (!live.history.length) { toast('Nothing to undo.'); return; }
  const prev = live.history.pop();
  live.ptA = prev.ptA; live.ptB = prev.ptB;
  live.gamesA = prev.gamesA; live.gamesB = prev.gamesB;
  live.matchOver = false;
  saveLive(); renderLiveScore();
}

function renderLiveScore() {
  const nameA = selA.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
  const nameB = selB.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
  document.getElementById('live-label-a').textContent = nameA.length > 16 ? 'TEAM A' : nameA;
  document.getElementById('live-label-b').textContent = nameB.length > 16 ? 'TEAM B' : nameB;
  document.getElementById('live-games-a').textContent = live.gamesA;
  document.getElementById('live-games-b').textContent = live.gamesB;
  document.getElementById('deuce-sudden-btn').classList.toggle('active', live.deuceRule === 'sudden');
  document.getElementById('deuce-full-btn').classList.toggle('active', live.deuceRule === 'full');
  document.getElementById('serve-a-btn').classList.toggle('active', live.serve === 'a');
  document.getElementById('serve-b-btn').classList.toggle('active', live.serve === 'b');
  
  const servingName = live.serve === 'a' ? (nameA.length > 12 ? 'Team A' : nameA) : (nameB.length > 12 ? 'Team B' : nameB);
  document.getElementById('live-serve-indicator').textContent = `· 🎾 ${servingName} serving`;
  
  const { a, b, status } = getPointLabel(live.ptA, live.ptB);
  document.getElementById('live-pt-a').textContent = a;
  document.getElementById('live-pt-b').textContent = b;
  document.getElementById('live-game-status').textContent = status;
  
  const shortA = nameA.length > 12 ? 'Team A' : nameA;
  const shortB = nameB.length > 12 ? 'Team B' : nameB;
  document.getElementById('live-btn-a').textContent = `POINT — ${shortA}`;
  document.getElementById('live-btn-b').textContent = `POINT — ${shortB}`;
  const wb = document.getElementById('live-winner-banner'), wt = document.getElementById('live-winner-text');
  if (live.matchOver) {
    const w = live.gamesA > live.gamesB ? 'A' : 'B';
    const wn = w === 'A' ? nameA : nameB;
    wt.textContent = `🏆 ${wn} WIN ${live.gamesA}-${live.gamesB}!`;
    wb.style.display = 'block';
  } else { wb.style.display = 'none'; }
}

function renderLiveWidget() {
  const el = document.getElementById('live-viewer-card');
  if (!live || live.matchOver) {
    el.style.display = 'none';
    return;
  }
  
  const nameA = selA.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
  const nameB = selB.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
  
  document.getElementById('lv-name-a').textContent = nameA.length > 16 ? 'TEAM A' : nameA;
  document.getElementById('lv-name-b').textContent = nameB.length > 16 ? 'TEAM B' : nameB;
  document.getElementById('lv-games-a').textContent = live.gamesA;
  document.getElementById('lv-games-b').textContent = live.gamesB;
  
  const { a, b, status } = getPointLabel(live.ptA, live.ptB);
  document.getElementById('lv-pt-a').textContent = a;
  document.getElementById('lv-pt-b').textContent = b;
  document.getElementById('lv-status').textContent = status || (live.serve === 'a' ? '🎾 Serving: Team A' : '🎾 Serving: Team B');
  
  el.style.display = 'block';
}

let liveListener = null;
function setupLiveListener(seasonId) {
  if (liveListener) liveListener();
  if (!seasonId) return;
  
  liveListener = db.collection("live_matches").doc(seasonId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        live = data.live;
        selA = data.selA;
        selB = data.selB;
        
        renderLiveWidget();
        if (scoreMode === 'live') {
            renderLiveScore();
        } else if (scoreMode === 'quick') {
            const matchPage = document.getElementById('page-match');
            if (matchPage && matchPage.classList.contains('active')) {
                if (selA.length === 0 && selB.length === 0 && scoreA === 0 && scoreB === 0) {
                    renderMatchSetup();
                }
            }
        }
      } else {
          document.getElementById('live-viewer-card').style.display = 'none';
      }
    });
}

async function autoSaveLiveMatch() {
  if (isDateLocked(today())) { toast('⚠️ Session locked — match not saved.'); return; }
  scoreA = live.gamesA; scoreB = live.gamesB;
  await confirmMatch();
  clearLive();
  resetLive();
}

// ── SCORING (quick mode) ─────────────────────────────────────
function adjustScore(team, delta) {
  const fmt = getFormat(state.currentSeason);
  const sideMax = fmt.type === 'bo' ? Math.ceil(fmt.n / 2) : fmt.n;
  if (team === 'a') scoreA = Math.max(0, Math.min(sideMax, scoreA + delta));
  else scoreB = Math.max(0, Math.min(sideMax, scoreB + delta));
  updateScoreDisplay();
}
function updateScoreDisplay() {
  const fmt = getFormat(state.currentSeason);
  const over = isMatchOver(scoreA, scoreB, fmt);
  const dA = document.getElementById('score-display-a'), dB = document.getElementById('score-display-b');
  dA.textContent = scoreA; dB.textContent = scoreB;
  dA.className = 'score-num' + (over && scoreA > scoreB ? ' winning' : over && scoreA < scoreB ? ' losing' : '');
  dB.className = 'score-num' + (over && scoreB > scoreA ? ' winning' : over && scoreB < scoreA ? ' losing' : '');
  const banner = document.getElementById('winner-banner'), bt = document.getElementById('winner-banner-text');
  if (over && scoreA !== scoreB) {
    const w = scoreA > scoreB ? 'A' : 'B';
    const names = w === 'A' ? selA.map(id => state.allPlayers.find(p => p.id === id)?.name).join(' & ') : selB.map(id => state.allPlayers.find(p => p.id === id)?.name).join(' & ');
    bt.textContent = `🏆 ${names} WIN ${scoreA}-${scoreB}!`; banner.style.display = 'block';
  } else { banner.style.display = 'none'; }
}
async function confirmMatch() {
  if (isDateLocked(today())) { toast('⚠️ Session is locked. Unlock it first.'); return; }
  const fmt = getFormat(state.currentSeason);
  if (!isMatchOver(scoreA, scoreB, fmt) || scoreA === scoreB) { toast(`⚠️ Match not finished — ${formatLabel(fmt)}`); return; }
  if (selA.length !== 2 || selB.length !== 2) { toast('⚠️ Pick 2 players per team'); return; }
  const w = scoreA > scoreB ? 'A' : 'B';
  
  const payload = { seasonId: state.currentSeason, date: today(), teamA: selA, teamB: selB, gamesA: scoreA, gamesB: scoreB, winner: w, format: fmt };
  
  try {
    const data = await fetch(`${API_URL}/matches/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());
    
    state.matches.push(data);
    const wn = w === 'A' ? selA.map(id => state.allPlayers.find(p => p.id === id)?.name).join(' & ') : selB.map(id => state.allPlayers.find(p => p.id === id)?.name).join(' & ');
    document.getElementById('modal-match-saved-desc').textContent = `${wn} win ${scoreA}–${scoreB}`;
    openModal('modal-match-saved');
    clearLive(); resetLive();
    if (state.currentSeason) {
      db.collection("live_matches").doc(state.currentSeason).delete()
        .catch(e => console.error("Error deleting live match:", e));
    }
    renderMatchSetup(); updateHeader();
  } catch (e) {
    toast('❌ Failed to save match');
    console.error(e);
  }
}

// ── HISTORY ──────────────────────────────────────────────────
function renderHistory() {
  updateSessionBtn();
  const el = document.getElementById('match-history-list');
  const matches = seasonMatches(state.currentSeason).slice().reverse();
  if (!matches.length) { el.innerHTML = '<div class="empty">No matches yet this season.</div>'; return; }
  const total = matches.length;
  el.innerHTML = matches.map((m, i) => {
    const na = m.teamA.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
    const nb = m.teamB.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
    const locked = isDateLocked(m.date);
    const fmtStr = m.format ? formatLabel(m.format) : '';
    return `<div class="match-card ${locked ? 'locked' : ''}">
  <div class="match-meta">
    <span>Match #${total - i} · ${formatDate(m.date)}${fmtStr ? ' · ' + fmtStr : ''}${locked ? ' 🔒' : ''}</span>
    ${locked
        ? `<span style="font-size:10px;color:var(--green-light);cursor:pointer" onclick="toggleSessionLock()">🔓 Unlock</span>`
        : `<button onclick="deleteMatch('${m.id}')" style="background:none;border:none;color:#EF4444;font-size:18px;cursor:pointer;padding:4px 8px;line-height:1">🗑</button>`}
  </div>
  <div class="match-body">
    <div class="match-team">
      <div class="match-team-names">${na}</div>
      <span class="tag-pill ${m.winner === 'A' ? 'tag-win' : 'tag-loss'}">${m.winner === 'A' ? 'WIN' : 'LOSS'}</span>
    </div>
    <div class="match-score-block">
      <div class="match-score"><span class="${m.winner === 'A' ? 'score-win' : 'score-lose'}">${m.gamesA}</span><span style="color:var(--text-muted)"> – </span><span class="${m.winner === 'B' ? 'score-win' : 'score-lose'}">${m.gamesB}</span></div>
      <div class="match-label">GAMES</div>
    </div>
    <div class="match-team" style="text-align:right">
      <div class="match-team-names">${nb}</div>
      <span class="tag-pill ${m.winner === 'B' ? 'tag-win' : 'tag-loss'}">${m.winner === 'B' ? 'WIN' : 'LOSS'}</span>
    </div>
  </div>
</div>`;
  }).join('');
}
function updateSessionBtn() {
  const btn = document.getElementById('session-btn'); if (!btn) return;
  const locked = isDateLocked(today());
  btn.textContent = locked ? '🔓 Unlock Today' : '🔒 End Session';
  btn.style.borderColor = locked ? 'var(--green)' : '';
  btn.style.color = locked ? 'var(--green-light)' : '';
}
async function toggleSessionLock() {
  const t = today();
  if (isDateLocked(t)) {
    await fetch(`${API_URL}/matches/locked-dates/${t}`, { method: 'DELETE' });
    state.lockedDates = state.lockedDates.filter(d => d !== t);
  } else {
    const n = seasonMatches(state.currentSeason).filter(m => m.date === t).length;
    if (!n) { toast('⚠️ No matches today to lock.'); return; }
    await fetch(`${API_URL}/matches/locked-dates/${t}`, { method: 'POST' });
    state.lockedDates.push(t);
  }
  renderHistory();
}
let _deleteMatchId = null;
function deleteMatch(id) {
  const m = state.matches.find(x => x.id === id); if (!m) return;
  _deleteMatchId = id;
  const na = m.teamA.map(i => state.allPlayers.find(p => p.id === i)?.name || '?').join(' & ');
  const nb = m.teamB.map(i => state.allPlayers.find(p => p.id === i)?.name || '?').join(' & ');
  document.getElementById('modal-delete-match-desc').textContent = `${na}  ${m.gamesA}–${m.gamesB}  ${nb}`;
  openModal('modal-delete-match');
}
async function confirmDeleteMatch() {
  if (_deleteMatchId === null) return;
  const id = _deleteMatchId; _deleteMatchId = null;
  closeModal('modal-delete-match');
  
  await fetch(`${API_URL}/matches/${id}`, { method: 'DELETE' });
  
  state.matches = state.matches.filter(m => m.id !== id);
  renderHistory(); updateHeader();
}

// ── SEASONS ──────────────────────────────────────────────────
function renderSeasons() {
  const el = document.getElementById('seasons-list');
  if (!state.seasons.length) { el.innerHTML = '<div class="empty">No seasons yet.</div>'; return; }
  el.innerHTML = [...state.seasons].reverse().map(s => `
<div class="season-row">
  <div class="season-num" onclick="switchSeason('${s.id}')" title="Switch to this season">${s.id}</div>
  <div class="season-info-block">
    <div class="season-name">${s.name}${s.id === state.currentSeason ? ' <span style="color:var(--green-light);font-size:11px">● Active</span>' : ''}</div>
    <div class="season-dates">${formatDate(s.startDate)} – ${formatDate(s.endDate)}</div>
    <div class="season-fmt">${formatLabel(s.format)}</div>
    <div class="season-fmt">${getSeasonPlayers(s.id).length} players</div>
    ${s.winner ? `<div class="season-winner">🏆 ${s.winner}</div>` : `<div class="text-sm text-muted">In progress</div>`}
  </div>
  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
    <div class="text-sm text-muted">${seasonMatches(s.id).length} matches</div>
    <button onclick="deleteSeason('${s.id}')" style="background:none;border:1px solid #7F1D1D;border-radius:6px;color:#FCA5A5;font-size:11px;padding:3px 8px;cursor:pointer;font-family:'DM Sans',sans-serif">🗑 Delete</button>
  </div>
</div>`).join('');
}

let _deleteSeasonId = null;
function deleteSeason(id) {
  if (state.seasons.length === 1) { toast('⚠️ Cannot delete the only season.'); return; }
  const s = state.seasons.find(x => x.id === id); if (!s) return;
  _deleteSeasonId = id;
  document.getElementById('modal-delete-season-desc').textContent = `"${s.name}" · ${seasonMatches(id).length} match(es)`;
  openModal('modal-delete-season');
}
async function confirmDeleteSeason() {
  if (_deleteSeasonId === null) return;
  const id = _deleteSeasonId; _deleteSeasonId = null;
  closeModal('modal-delete-season');
  
  await fetch(`${API_URL}/seasons/${id}`, { method: 'DELETE' });
  
  state.seasons = state.seasons.filter(x => x.id !== id);
  state.matches = state.matches.filter(m => m.seasonId !== id);
  delete state.seasonPlayers[id];
  if (state.currentSeason === id) state.currentSeason = state.seasons[state.seasons.length - 1]?.id || null;
  renderSeasons(); updateHeader(); renderStandings();
}

// ── NEW SEASON ────────────────────────────────────────────────
let modalFmt = { type: 'firstto', n: 4 };
let nsSelectedPlayers = new Set();
const FIRSTTO_OPTS = [3, 4, 5, 6, 7, 8, 9, 10];
const BO_OPTS = [3, 5, 7, 9, 11];

function buildNPicker(cid, opts, sel, fn) {
  document.getElementById(cid).innerHTML = opts.map(n => `<div class="n-opt ${n === sel ? 'active' : ''}" onclick="${fn}(${n})">${n}</div>`).join('');
}
function setFormatType(type) {
  modalFmt.type = type; modalFmt.n = type === 'firstto' ? 4 : 7;
  document.getElementById('firstto-picker').style.display = type === 'firstto' ? '' : 'none';
  document.getElementById('bo-picker').style.display = type === 'bo' ? '' : 'none';
  document.getElementById('fmt-btn-firstto').classList.toggle('active', type === 'firstto');
  document.getElementById('fmt-btn-bo').classList.toggle('active', type === 'bo');
  refreshPickers(); updateFormatPreview();
}
function pickFirstToN(n) { modalFmt.n = n; refreshPickers(); updateFormatPreview(); }
function pickBoN(n) { modalFmt.n = n; refreshPickers(); updateFormatPreview(); }
function refreshPickers() {
  buildNPicker('firstto-n-picker', FIRSTTO_OPTS, modalFmt.type === 'firstto' ? modalFmt.n : 4, 'pickFirstToN');
  buildNPicker('bo-n-picker', BO_OPTS, modalFmt.type === 'bo' ? modalFmt.n : 7, 'pickBoN');
}
function updateFormatPreview() {
  const t = winTarget(modalFmt);
  document.getElementById('format-preview').innerHTML = `<strong>${formatLabel(modalFmt)}</strong> — win by reaching <strong>${t} games</strong>${modalFmt.type === 'bo' ? ' (max ' + modalFmt.n + ' games)' : ''}`;
}
function toggleNsPlayer(id) {
  if (nsSelectedPlayers.has(id)) nsSelectedPlayers.delete(id);
  else nsSelectedPlayers.add(id);
  renderNsChecklist();
}
function renderNsChecklist() {
  const el = document.getElementById('ns-player-checklist');
  if (!state.allPlayers.length) { el.innerHTML = '<div class="empty" style="padding:8px 0">No players yet — add them after creating the season.</div>'; return; }
  el.innerHTML = state.allPlayers.map((p, i) => {
    const [bg, fg] = getColor(i);
    const checked = nsSelectedPlayers.has(p.id);
    return `<div class="player-check-row">
  <div class="player-check-avatar" style="background:${bg};color:${fg}">${initials(p.name)}</div>
  <div class="player-check-name">${p.name}</div>
  <button onclick="deletePlayerGlobal('${p.id}');closeModal('modal-new-season')" style="background:none;border:none;color:#EF4444;font-size:16px;cursor:pointer;padding:2px 6px;line-height:1" title="Delete player globally">🗑</button>
  <label class="toggle"><input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleNsPlayer('${p.id}')"><span class="toggle-slider"></span></label>
</div>`;
  }).join('');
}
function openNewSeasonModal() {
  modalFmt = { type: 'firstto', n: 4 };
  nsSelectedPlayers = new Set(state.allPlayers.map(p => p.id));
  const now = new Date(), end = new Date(now); end.setMonth(end.getMonth() + 3);
  document.getElementById('ns-name').value = '';
  document.getElementById('ns-start').value = today();
  document.getElementById('ns-end').value = end.toISOString().split('T')[0];
  setFormatType('firstto');
  renderNsChecklist();
  openModal('modal-new-season');
}
async function startNewSeason() {
  const startDate = document.getElementById('ns-start').value;
  const endDate = document.getElementById('ns-end').value;
  if (!startDate || !endDate) { toast('⚠️ Set start and end dates.'); return; }
  if (endDate <= startDate) { toast('⚠️ End date must be after start date.'); return; }
  const cn = document.getElementById('ns-name').value.trim();
  
  if (state.currentSeason) {
    const stats = getPlayerStats(state.currentSeason);
    const winner = stats.length ? stats[0].name : null;
    if (winner) {
      await fetch(`${API_URL}/seasons/${state.currentSeason}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentSeason(), winner })
      });
      const curr = currentSeason(); if (curr) curr.winner = winner;
    }
  }
  const newName = cn || (state.seasons.length > 0 ? `Season ${state.seasons.length + 1}` : 'Season 1');
  
  const payload = { name: newName, startDate: startDate, endDate: endDate, format: modalFmt, playerIds: [...nsSelectedPlayers] };
  
  try {
    const data = await fetch(`${API_URL}/seasons/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());
    
    state.seasons.push(data);
    state.seasonPlayers[data.id] = data.playerIds || [];
    state.currentSeason = data.id;
    closeModal('modal-new-season'); renderSeasons(); updateHeader(); renderStandings();
    toast(`✅ ${data.name} started!`);
  } catch (e) {
    toast('❌ Failed to start season');
    console.error(e);
  }
}

// ── PLAYER PHOTOS ─────────────────────────────────────────────
async function uploadPlayerPhoto(playerId, file) {
  if (!file) return;
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const MAX = 400;
  const scale = Math.min(MAX / img.width, MAX / img.height, 1);
  canvas.width = img.width * scale; canvas.height = img.height * scale;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  
  const base64 = canvas.toDataURL('image/jpeg', 0.7);
  
  const p = state.allPlayers.find(x => x.id === playerId);
  const updatedPlayer = { ...p, photo: base64 };
  
  try {
    await fetch(`${API_URL}/players/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPlayer)
    });
    
    if (p) p.photo = base64;
    renderPlayersPage(); renderStandings();
    toast('✅ Photo updated!');
  } catch (e) {
    toast('❌ Failed to update photo');
    console.error(e);
  }
}

function playerAvatar(p, size = 34) {
  const idx = state.allPlayers.findIndex(x => x.id === p.id);
  const [bg, fg] = getColor(idx);
  if (p.photo) {
    return `<img src="${p.photo}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.floor(size * 0.38)}px;flex-shrink:0">${initials(p.name)}</div>`;
}

// ── INIT ─────────────────────────────────────────────────────
(async () => {
  await loadAll();
  renderStandings();
  document.getElementById('new-player-name').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });
})();
