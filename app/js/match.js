// ── MATCH STATE ──────────────────────────────────────────────
let selA   = [];   // selected player IDs for Team A
let selB   = [];   // selected player IDs for Team B
let scoreA = 0;
let scoreB = 0;
let scoreMode = 'quick'; // 'quick' | 'live'

// ── SETUP ────────────────────────────────────────────────────
function renderMatchSetup() {
  // Check for in-progress live match to resume
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
  document.getElementById('live-mode').style.display  = 'none';
  document.getElementById('mode-quick-btn').classList.add('active');
  document.getElementById('mode-live-btn').classList.remove('active');

  renderTeamSelectors(null);
  document.getElementById('score-section').style.display = 'none';
}

// ── TEAM SELECTORS ───────────────────────────────────────────
function renderTeamSelectors(hintOverride) {
  const players = getSeasonPlayers(state.currentSeason);

  ['a', 'b'].forEach(t => {
    const el = document.getElementById('team-' + t + '-select');
    if (!players.length) {
      el.innerHTML = '<div class="text-sm text-muted">No players in this season.</div>';
      return;
    }
    el.innerHTML = players.map(p => {
      const inA  = selA.includes(p.id);
      const inB  = selB.includes(p.id);
      const cls  = inA ? 'sel-a' : inB ? 'sel-b' : '';
      const extra = (t === 'a' && inB) || (t === 'b' && inA) ? 'disabled' : !isAvailable(p.id) ? 'unavail' : '';
      return `<div class="p-tag ${cls} ${extra}" onclick="togglePlayer(${p.id},'${t}')">${p.name}</div>`;
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
  if (team === 'a') {
    if (selA.includes(id)) selA = selA.filter(x => x !== id);
    else if (selA.length < 2) selA.push(id);
  } else {
    if (selB.includes(id)) selB = selB.filter(x => x !== id);
    else if (selB.length < 2) selB.push(id);
  }
  renderTeamSelectors(null);
}

// ── SCORE MODE TOGGLE ────────────────────────────────────────
function setScoreMode(mode) {
  scoreMode = mode;
  document.getElementById('quick-mode').style.display   = mode === 'quick' ? 'block' : 'none';
  document.getElementById('live-mode').style.display    = mode === 'live'  ? 'block' : 'none';
  document.getElementById('mode-quick-btn').classList.toggle('active', mode === 'quick');
  document.getElementById('mode-live-btn').classList.toggle('active',  mode === 'live');
  if (mode === 'live') renderLiveScore();
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
function pairKey(a, b) { return [a, b].sort().join('-'); }
function countPairRepeats(combo, pairs) {
  let r = 0;
  if (pairs.has(pairKey(combo[0], combo[1]))) r++;
  if (pairs.has(pairKey(combo[2], combo[3]))) r++;
  return r;
}

// How many times a player played today
function getMatchesTodayCount(playerId) {
  return seasonMatches(state.currentSeason)
    .filter(m => m.date === today() && (m.teamA.includes(playerId) || m.teamB.includes(playerId)))
    .length;
}
// How many matches a player has this season
function getSeasonMatchCount(playerId) {
  return seasonMatches(state.currentSeason)
    .filter(m => m.teamA.includes(playerId) || m.teamB.includes(playerId))
    .length;
}

function randomizeTeams() {
  const avail = getSeasonPlayers(state.currentSeason).filter(p => isAvailable(p.id));
  if (avail.length < 4) {
    document.getElementById('team-selection-hint').textContent = `⚠️ Need 4+ available players (${avail.length} available).`;
    return;
  }

  const pastPairs = getPastPairs(state.currentSeason);

  // Priority: fewest matches today → fewest matches this season → random
  const sorted = [...avail].sort((a, b) => {
    const todayDiff  = getMatchesTodayCount(a.id) - getMatchesTodayCount(b.id);
    if (todayDiff !== 0) return todayDiff;
    const seasonDiff = getSeasonMatchCount(a.id) - getSeasonMatchCount(b.id);
    if (seasonDiff !== 0) return seasonDiff;
    return Math.random() - 0.5;
  });

  const pool     = sorted.slice(0, 4);
  const minToday = getMatchesTodayCount(pool[3].id);
  const fallback = getMatchesTodayCount(pool[0].id) > 0;

  const ids   = pool.map(p => p.id);
  const splits = [
    [ids[0], ids[1], ids[2], ids[3]],
    [ids[0], ids[2], ids[1], ids[3]],
    [ids[0], ids[3], ids[1], ids[2]]
  ];
  splits.sort((a, b) => countPairRepeats(a, pastPairs) - countPairRepeats(b, pastPairs));

  const best    = splits[0];
  const repeats = countPairRepeats(best, pastPairs);

  selA = [best[0], best[1]];
  selB = [best[2], best[3]];

  let hint = '✅ Teams ready!';
  if (fallback)       hint = `⚠️ Everyone played today — picking least played (${minToday} match${minToday > 1 ? 'es' : ''} today).`;
  else if (repeats === 2) hint = '⚠️ All pairs have played together before.';
  else if (repeats === 1) hint = '⚠️ One pair has played together before — best available.';

  renderTeamSelectors(hint);
}

// ── QUICK SCORE ──────────────────────────────────────────────
function adjustScore(team, delta) {
  const fmt     = getFormat(state.currentSeason);
  const sideMax = fmt.type === 'bo' ? Math.ceil(fmt.n / 2) : fmt.n;
  if (team === 'a') scoreA = Math.max(0, Math.min(sideMax, scoreA + delta));
  else              scoreB = Math.max(0, Math.min(sideMax, scoreB + delta));
  updateScoreDisplay();
}

function updateScoreDisplay() {
  const fmt  = getFormat(state.currentSeason);
  const over = isMatchOver(scoreA, scoreB, fmt);
  const dA   = document.getElementById('score-display-a');
  const dB   = document.getElementById('score-display-b');

  dA.textContent = scoreA;
  dB.textContent = scoreB;
  dA.className   = 'score-num' + (over && scoreA > scoreB ? ' winning' : over && scoreA < scoreB ? ' losing' : '');
  dB.className   = 'score-num' + (over && scoreB > scoreA ? ' winning' : over && scoreB < scoreA ? ' losing' : '');

  const banner = document.getElementById('winner-banner');
  const bt     = document.getElementById('winner-banner-text');
  if (over && scoreA !== scoreB) {
    const w     = scoreA > scoreB ? 'A' : 'B';
    const names = w === 'A'
      ? selA.map(id => state.allPlayers.find(p => p.id === id)?.name).join(' & ')
      : selB.map(id => state.allPlayers.find(p => p.id === id)?.name).join(' & ');
    bt.textContent     = `🏆 ${names} WIN ${scoreA}-${scoreB}!`;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

// ── CONFIRM MATCH ────────────────────────────────────────────
async function confirmMatch() {
  if (isDateLocked(today())) { toast('⚠️ Session is locked. Unlock it first.'); return; }

  const fmt = getFormat(state.currentSeason);
  if (!isMatchOver(scoreA, scoreB, fmt) || scoreA === scoreB) {
    toast(`⚠️ Match not finished — ${formatLabel(fmt)}`);
    return;
  }
  if (selA.length !== 2 || selB.length !== 2) { toast('⚠️ Pick 2 players per team'); return; }

  const w = scoreA > scoreB ? 'A' : 'B';
  const payload = {
    season_id: state.currentSeason,
    date:      today(),
    team_a:    selA, team_b: selB,
    games_a:   scoreA, games_b: scoreB,
    winner:    w,
    format:    JSON.parse(JSON.stringify(fmt))
  };

  const { data, error } = await sb.from('matches').insert(payload).select().single();
  if (error) { toast('❌ Failed to save match'); console.error(error); return; }

  state.matches.push({
    id: data.id, seasonId: data.season_id, date: data.date,
    teamA: data.team_a, teamB: data.team_b,
    gamesA: data.games_a, gamesB: data.games_b,
    winner: data.winner, format: data.format
  });

  const wn = w === 'A'
    ? selA.map(id => state.allPlayers.find(p => p.id === id)?.name).join(' & ')
    : selB.map(id => state.allPlayers.find(p => p.id === id)?.name).join(' & ');

  document.getElementById('modal-match-saved-desc').textContent = `${wn} win ${scoreA}–${scoreB}`;
  openModal('modal-match-saved');

  clearLive();
  resetLive();
  renderMatchSetup();
  updateHeader();
}
