// ── LIVE SCORER STATE ────────────────────────────────────────
let live = {
  gamesA:    0,
  gamesB:    0,
  ptA:       0,       // raw point count (0 = 0, 1 = 15, 2 = 30, 3 = 40, 4+ = deuce/ad)
  ptB:       0,
  deuceRule: 'sudden', // 'sudden' | 'full'
  serve:     'a',      // 'a' | 'b'
  history:   [],       // snapshots for undo [{ptA,ptB,gamesA,gamesB}]
  matchOver: false
};

// ── PERSISTENCE ──────────────────────────────────────────────
function saveLive() {
  localStorage.setItem(LIVE_STORE, JSON.stringify({ live, selA, selB, seasonId: state.currentSeason }));

  // Push to Supabase so other phones see live score
  sb.from('live_match').update({
    season_id:   state.currentSeason,
    team_a:      selA,  team_b:    selB,
    games_a:     live.gamesA, games_b: live.gamesB,
    pt_a:        live.ptA,    pt_b:    live.ptB,
    deuce_rule:  live.deuceRule,
    match_over:  live.matchOver,
    updated_at:  new Date().toISOString()
  }).eq('id', 1).then(({ error }) => { if (error) console.error('live sync error:', error); });
}

function loadLive() {
  try {
    const d = JSON.parse(localStorage.getItem(LIVE_STORE) || 'null');
    if (d && d.seasonId === state.currentSeason && d.selA && d.selB) {
      live = d.live;
      selA = d.selA;
      selB = d.selB;
      return true;
    }
  } catch {}
  return false;
}

function clearLive() {
  localStorage.removeItem(LIVE_STORE);
  // Clear live match in Supabase
  sb.from('live_match').update({
    team_a: null, team_b: null,
    games_a: 0, games_b: 0,
    pt_a: 0, pt_b: 0,
    match_over: false,
    updated_at: new Date().toISOString()
  }).eq('id', 1);
}

function resetLive() {
  live = {
    gamesA: 0, gamesB: 0,
    ptA: 0, ptB: 0,
    deuceRule: live.deuceRule || 'sudden',
    serve:     live.serve     || 'a',
    history:   [],
    matchOver: false
  };
}

// ── CONTROLS ─────────────────────────────────────────────────
function setServe(team) {
  live.serve = team;
  document.getElementById('serve-a-btn').classList.toggle('active', team === 'a');
  document.getElementById('serve-b-btn').classList.toggle('active', team === 'b');
  saveLive();
  renderLiveScore();
}

function setDeuceRule(rule) {
  live.deuceRule = rule;
  document.getElementById('deuce-sudden-btn').classList.toggle('active', rule === 'sudden');
  document.getElementById('deuce-full-btn').classList.toggle('active',   rule === 'full');
  saveLive();
  renderLiveScore();
}

// ── POINT LOGIC ──────────────────────────────────────────────
function livePoint(team) {
  if (live.matchOver) return;

  // Save snapshot for undo
  live.history.push({ ptA: live.ptA, ptB: live.ptB, gamesA: live.gamesA, gamesB: live.gamesB });

  if (team === 'a') live.ptA++;
  else              live.ptB++;

  const gameWon = checkGameEnd();
  if (gameWon) {
    if (gameWon === 'a') live.gamesA++;
    else                 live.gamesB++;
    live.ptA = 0;
    live.ptB = 0;

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
    // At 40-40 (3-3), next point wins
    if (a >= 3 && b >= 3) return a > b ? 'a' : 'b';
    if (a >= 4) return 'a';
    if (b >= 4) return 'b';
  } else {
    // Full deuce: need 2-point lead after deuce
    if (a >= 3 && b >= 3) {
      if (a - b >= 2) return 'a';
      if (b - a >= 2) return 'b';
      return null; // still in deuce
    }
    if (a >= 4) return 'a';
    if (b >= 4) return 'b';
  }
  return null;
}

function getPointLabel(ptA, ptB) {
  const a = ptA, b = ptB;

  if (live.deuceRule === 'sudden') {
    if (a >= 3 && b >= 3) return { a: '40', b: '40', status: '⚡ Sudden Death — next point wins!' };
    return { a: PT_LABELS[Math.min(a, 3)], b: PT_LABELS[Math.min(b, 3)], status: '' };
  } else {
    if (a >= 3 && b >= 3) {
      if (a === b) return { a: '40', b: '40', status: 'Deuce' };
      if (a > b)   return { a: 'AD', b: '—',  status: 'Advantage Team A' };
      return             { a: '—',  b: 'AD',  status: 'Advantage Team B' };
    }
    return { a: PT_LABELS[Math.min(a, 3)], b: PT_LABELS[Math.min(b, 3)], status: '' };
  }
}

function undoLastPoint() {
  if (!live.history.length) { toast('Nothing to undo.'); return; }
  const prev = live.history.pop();
  live.ptA      = prev.ptA;
  live.ptB      = prev.ptB;
  live.gamesA   = prev.gamesA;
  live.gamesB   = prev.gamesB;
  live.matchOver = false;
  saveLive();
  renderLiveScore();
}

// ── RENDER ───────────────────────────────────────────────────
function renderLiveScore() {
  const nameA = selA.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
  const nameB = selB.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');

  document.getElementById('live-label-a').textContent = nameA.length > 16 ? 'TEAM A' : nameA;
  document.getElementById('live-label-b').textContent = nameB.length > 16 ? 'TEAM B' : nameB;
  document.getElementById('live-games-a').textContent = live.gamesA;
  document.getElementById('live-games-b').textContent = live.gamesB;

  document.getElementById('deuce-sudden-btn').classList.toggle('active', live.deuceRule === 'sudden');
  document.getElementById('deuce-full-btn').classList.toggle('active',   live.deuceRule === 'full');
  document.getElementById('serve-a-btn').classList.toggle('active', live.serve === 'a');
  document.getElementById('serve-b-btn').classList.toggle('active', live.serve === 'b');

  const servingName = live.serve === 'a'
    ? (nameA.length > 12 ? 'Team A' : nameA)
    : (nameB.length > 12 ? 'Team B' : nameB);
  document.getElementById('live-serve-indicator').textContent = `· 🎾 ${servingName} serving`;

  const { a, b, status } = getPointLabel(live.ptA, live.ptB);
  document.getElementById('live-pt-a').textContent = a;
  document.getElementById('live-pt-b').textContent = b;
  document.getElementById('live-game-status').textContent = status;

  const shortA = nameA.length > 12 ? 'Team A' : nameA;
  const shortB = nameB.length > 12 ? 'Team B' : nameB;
  document.getElementById('live-btn-a').textContent = `POINT — ${shortA}`;
  document.getElementById('live-btn-b').textContent = `POINT — ${shortB}`;

  const wb = document.getElementById('live-winner-banner');
  const wt = document.getElementById('live-winner-text');
  if (live.matchOver) {
    const w  = live.gamesA > live.gamesB ? 'A' : 'B';
    const wn = w === 'A' ? nameA : nameB;
    wt.textContent  = `🏆 ${wn} WIN ${live.gamesA}-${live.gamesB}!`;
    wb.style.display = 'block';
  } else {
    wb.style.display = 'none';
  }
}

// ── AUTO SAVE ────────────────────────────────────────────────
async function autoSaveLiveMatch() {
  if (isDateLocked(today())) { toast('⚠️ Session locked — match not saved.'); return; }
  scoreA = live.gamesA;
  scoreB = live.gamesB;
  await confirmMatch();
  clearLive();
  resetLive();
}

// ── LIVE VIEWER (other phones watching) ──────────────────────
function renderLiveViewer(row) {
  if (!row || !row.team_a || !row.team_b || row.team_a.length < 2) {
    document.getElementById('live-viewer-card').style.display = 'none';
    return;
  }

  document.getElementById('live-viewer-card').style.display = 'block';

  const nameA    = row.team_a.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
  const nameB    = row.team_b.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
  const deuceRule = row.deuce_rule || 'sudden';
  const ptA = row.pt_a || 0, ptB = row.pt_b || 0;

  let ptLabelA, ptLabelB, status = '';
  if (deuceRule === 'sudden') {
    if (ptA >= 3 && ptB >= 3) { ptLabelA = '40'; ptLabelB = '40'; status = '⚡ Sudden Death!'; }
    else { ptLabelA = PT_LABELS[Math.min(ptA, 3)]; ptLabelB = PT_LABELS[Math.min(ptB, 3)]; }
  } else {
    if (ptA >= 3 && ptB >= 3) {
      if (ptA === ptB)  { ptLabelA = '40'; ptLabelB = '40'; status = 'Deuce'; }
      else if (ptA > ptB) { ptLabelA = 'AD'; ptLabelB = '—';  status = 'Advantage ' + nameA.split(' ')[0]; }
      else                { ptLabelA = '—';  ptLabelB = 'AD'; status = 'Advantage ' + nameB.split(' ')[0]; }
    } else {
      ptLabelA = PT_LABELS[Math.min(ptA, 3)];
      ptLabelB = PT_LABELS[Math.min(ptB, 3)];
    }
  }

  document.getElementById('lv-name-a').textContent  = nameA.length > 16 ? 'Team A' : nameA;
  document.getElementById('lv-name-b').textContent  = nameB.length > 16 ? 'Team B' : nameB;
  document.getElementById('lv-games-a').textContent = row.games_a || 0;
  document.getElementById('lv-games-b').textContent = row.games_b || 0;
  document.getElementById('lv-pt-a').textContent    = ptLabelA;
  document.getElementById('lv-pt-b').textContent    = ptLabelB;
  document.getElementById('lv-status').textContent  = status;

  const winner = document.getElementById('lv-winner');
  winner.style.display = row.match_over ? 'block' : 'none';
  if (row.match_over) {
    const wn = (row.games_a || 0) > (row.games_b || 0) ? nameA : nameB;
    winner.textContent = `🏆 ${wn} WIN ${row.games_a}-${row.games_b}!`;
  }
}
