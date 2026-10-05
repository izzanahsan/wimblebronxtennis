// ── APP STATE ────────────────────────────────────────────────
// Single source of truth. All JS files read from this object.
let state = {
  seasons:       [],   // [{ id, name, startDate, endDate, winner, format }]
  allPlayers:    [],   // [{ id, name, photo_url }] — master list across all seasons
  seasonPlayers: {},   // { seasonId: [playerId, ...] }
  matches:       [],   // [{ id, seasonId, date, teamA, teamB, gamesA, gamesB, winner, format }]
  availability:  {},   // { playerId: bool }
  lockedDates:   [],   // ['2025-01-01', ...]
  currentSeason: null  // currently viewed season id
};

// ── LOAD ALL DATA FROM SUPABASE ──────────────────────────────
async function loadAll() {
  setLoading('Connecting...');

  const [
    { data: seasons, error: se },
    { data: players, error: pe },
    { data: sp,      error: spe },
    { data: matches, error: me },
    { data: locked },
    { data: avail }
  ] = await Promise.all([
    sb.from('seasons').select('*').order('id'),
    sb.from('players').select('*').order('id'),
    sb.from('season_players').select('*'),
    sb.from('matches').select('*').order('id'),
    sb.from('locked_dates').select('*'),
    sb.from('availability').select('*'),
  ]);

  if (se || pe || spe || me) {
    toast('❌ Failed to load data. Check connection.');
    console.error(se, pe, spe, me);
  }

  state.seasons = (seasons || []).map(s => ({
    id: s.id, name: s.name,
    startDate: s.start_date, endDate: s.end_date,
    winner: s.winner, format: s.format
  }));

  state.allPlayers = players || [];

  state.seasonPlayers = {};
  (sp || []).forEach(r => {
    if (!state.seasonPlayers[r.season_id]) state.seasonPlayers[r.season_id] = [];
    state.seasonPlayers[r.season_id].push(r.player_id);
  });

  state.matches = (matches || []).map(m => ({
    id: m.id, seasonId: m.season_id, date: m.date,
    teamA: m.team_a, teamB: m.team_b,
    gamesA: m.games_a, gamesB: m.games_b,
    winner: m.winner, format: m.format
  }));

  state.lockedDates = (locked || []).map(r => r.date);

  state.availability = {};
  (avail || []).forEach(r => { state.availability[r.player_id] = r.available; });

  if (state.seasons.length) {
    state.currentSeason = state.seasons[state.seasons.length - 1].id;
  }

  hideLoading();
}

// ── STATE HELPERS ────────────────────────────────────────────
function currentSeason()       { return state.seasons.find(s => s.id === state.currentSeason); }
function seasonMatches(sid)    { return state.matches.filter(m => m.seasonId === sid); }
function getSeasonPlayers(sid) {
  const ids = state.seasonPlayers[sid] || [];
  return state.allPlayers.filter(p => ids.includes(p.id));
}
function isAvailable(id)       { return state.availability[id] !== false; }
function isDateLocked(d)       { return state.lockedDates.includes(d); }

// ── PLAYER STATS ─────────────────────────────────────────────
function getPlayerStats(sid) {
  const matches = seasonMatches(sid);
  const players = getSeasonPlayers(sid);

  return players.map(p => {
    let pts = 0, matchWins = 0, played = 0, gamesWon = 0, gamesLost = 0;
    const matchResults = [];

    matches.forEach(m => {
      const inA = m.teamA.includes(p.id);
      const inB = m.teamB.includes(p.id);
      if (!inA && !inB) return;
      played++;
      if (m.winner === 'A' && inA)      { pts += 3; matchWins++; gamesWon += m.gamesA; gamesLost += m.gamesB; matchResults.push(true); }
      else if (m.winner === 'B' && inB) { pts += 3; matchWins++; gamesWon += m.gamesB; gamesLost += m.gamesA; matchResults.push(true); }
      else if (inA)                     { pts += 1; gamesWon += m.gamesA; gamesLost += m.gamesB; matchResults.push(false); }
      else                              { pts += 1; gamesWon += m.gamesB; gamesLost += m.gamesA; matchResults.push(false); }
    });

    return {
      ...p, pts, matchWins, played,
      gamesWon, gamesLost,
      gameDiff: gamesWon - gamesLost,
      last5: matchResults.slice(-5)
    };
  }).sort((a, b) =>
    b.pts - a.pts ||
    b.matchWins - a.matchWins ||
    b.gameDiff - a.gameDiff ||
    b.gamesWon - a.gamesWon
  );
}
