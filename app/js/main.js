// ── MAIN ─────────────────────────────────────────────────────
// Entry point. Runs after all other scripts are loaded.

(async () => {
  await loadAll();
  renderStandings();
  setupRealtime();

  // Enter key to add player
  document.getElementById('new-player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPlayer();
  });

  // Register service worker for PWA install
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
