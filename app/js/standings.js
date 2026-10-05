// ── STANDINGS / LEADERBOARD ──────────────────────────────────
function renderStandings() {
  updateHeader();
  const stats = getPlayerStats(state.currentSeason);
  const el = document.getElementById('leaderboard-list');

  if (!stats.length) {
    el.innerHTML = '<div class="empty">No players in this season yet.</div>';
    return;
  }

  el.innerHTML = stats.map((p, i) => {
    const rc = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';

    const dots = Array.from({ length: 5 }, (_, j) => {
      if (j >= p.last5.length) return `<div class="win-dot"></div>`;
      return p.last5[j]
        ? `<div class="win-dot" style="background:#16A34A;border-color:#16A34A"></div>`
        : `<div class="win-dot" style="background:#DC2626;border-color:#DC2626"></div>`;
    }).join('');

    const diffStr  = p.gameDiff > 0 ? `+${p.gameDiff}` : p.gameDiff === 0 ? '±0' : `${p.gameDiff}`;
    const diffColor = p.gameDiff > 0 ? 'var(--green-light)' : p.gameDiff < 0 ? '#FCA5A5' : 'var(--text-muted)';

    return `
    <div class="lb-row">
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
