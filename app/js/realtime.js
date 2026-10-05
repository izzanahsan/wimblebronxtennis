// ── REALTIME SUBSCRIPTIONS ───────────────────────────────────
// Listens for changes made by other users and updates UI instantly

function setupRealtime() {
  sb.channel('wimblebronx-db')

    // New match logged by anyone
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, payload => {
      const m = payload.new;
      if (state.matches.find(x => x.id === m.id)) return; // already have it
      state.matches.push({
        id: m.id, seasonId: m.season_id, date: m.date,
        teamA: m.team_a, teamB: m.team_b,
        gamesA: m.games_a, gamesB: m.games_b,
        winner: m.winner, format: m.format
      });
      renderStandings();
      updateHeader();
      toast('🎾 New match logged!');
    })

    // Match deleted by anyone
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'matches' }, payload => {
      state.matches = state.matches.filter(m => m.id !== payload.old.id);
      renderStandings();
      updateHeader();
    })

    // New player added
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' }, payload => {
      if (state.allPlayers.find(x => x.id === payload.new.id)) return;
      state.allPlayers.push(payload.new);
      toast(`👤 ${payload.new.name} joined!`);
    })

    // Player updated (e.g. photo uploaded)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, payload => {
      const idx = state.allPlayers.findIndex(x => x.id === payload.new.id);
      if (idx >= 0) state.allPlayers[idx] = payload.new;
      renderStandings();
    })

    // Player added to a season
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'season_players' }, payload => {
      const { season_id, player_id } = payload.new;
      if (!state.seasonPlayers[season_id]) state.seasonPlayers[season_id] = [];
      if (!state.seasonPlayers[season_id].includes(player_id)) {
        state.seasonPlayers[season_id].push(player_id);
        if (season_id === state.currentSeason) {
          renderStandings();
          renderPlayersPage();
        }
      }
    })

    // Live match score updated (point-by-point scorer)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_match' }, payload => {
      renderLiveViewer(payload.new);
    })

    .subscribe();

  // Load current live match state on startup (for viewers)
  sb.from('live_match').select('*').eq('id', 1).single().then(({ data }) => {
    if (data) renderLiveViewer(data);
  });
}
