// ── POINT-BY-POINT STATS ─────────────────────────────────────
// A live-scored match stores its points as { deuce, w, s }:
//   deuce — 'sudden' | 'full'
//   w     — point winners, one char per point ('A' / 'B')
//   s     — serving team for each point ('A' / 'B')
// Everything below is derived by replaying that log.

// Who wins the game at this point count? null = game still going
function gameWinner(a, b, rule) {
  if (a >= 3 && b >= 3) {
    if (rule === 'sudden') return a > b ? 'A' : b > a ? 'B' : null; // 40-40 → deciding point
    if (a - b >= 2) return 'A';
    if (b - a >= 2) return 'B';
    return null;
  }
  if (a >= 4) return 'A';
  if (b >= 4) return 'B';
  return null;
}

// Would `side` win the game by winning the next point?
function isGamePointFor(side, a, b, rule) {
  return side === 'A' ? gameWinner(a + 1, b, rule) === 'A' : gameWinner(a, b + 1, rule) === 'B';
}

// Score labels + status line for the current game
function pointLabels(a, b, rule, serve, nameA = 'Team A', nameB = 'Team B') {
  let la = PT_LABELS[Math.min(a, 3)], lb = PT_LABELS[Math.min(b, 3)], status = '';

  if (a >= 3 && b >= 3) {
    if (rule === 'sudden')  { la = lb = '40'; status = '⚡ Deciding point — next point wins!'; }
    else if (a === b)       { la = lb = '40'; status = 'Deuce'; }
    else if (a > b)         { la = 'AD'; lb = '—'; status = `Advantage ${nameA}`; }
    else                    { la = '—'; lb = 'AD'; status = `Advantage ${nameB}`; }
  }

  if (serve && !(rule === 'sudden' && a >= 3 && b >= 3)) {
    const srv = serve.toUpperCase(), rcv = srv === 'A' ? 'B' : 'A';
    if (isGamePointFor(rcv, a, b, rule))      status = '🔥 Break point' + (status ? ` · ${status}` : '');
    else if (isGamePointFor(srv, a, b, rule)) status = 'Game point'     + (status ? ` · ${status}` : '');
  }
  return { a: la, b: lb, status };
}

function replayMatch(rec) {
  const rule = rec.deuce || 'sudden';
  const points = [], games = [];
  let a = 0, b = 0, gA = 0, gB = 0, g = null;

  for (let i = 0; i < rec.w.length; i++) {
    const w = rec.w[i], srv = rec.s[i] || 'A', rcv = srv === 'A' ? 'B' : 'A';
    if (!g) g = { server: srv, winner: null, deuce: false };

    const isBP = isGamePointFor(rcv, a, b, rule);
    if (a >= 3 && b >= 3) g.deuce = true;

    if (w === 'A') a++; else b++;
    points.push({ w, srv, isBP });

    const gw = gameWinner(a, b, rule);
    if (gw) {
      if (gw === 'A') gA++; else gB++;
      g.winner = gw;
      g.score  = [gA, gB];
      games.push(g);
      g = null; a = 0; b = 0;
    }
  }
  if (g) games.push(g); // unfinished game

  return { rule, points, games };
}

function emptyPointStats() {
  return {
    matches: 0, pts: 0, total: 0,
    srvPts: 0, srvWon: 0, retPts: 0, retWon: 0,
    srvGames: 0, holds: 0, retGames: 0, breaks: 0,
    bpChances: 0, bpWon: 0, bpFaced: 0, bpSaved: 0,
    deuceGames: 0, deuceWon: 0, streak: 0
  };
}

function teamPointStats(rep, side) {
  const s = emptyPointStats();
  s.matches = 1;
  s.total   = rep.points.length;
  let run = 0;

  rep.points.forEach(p => {
    const won = p.w === side;
    if (won) { s.pts++; run++; s.streak = Math.max(s.streak, run); } else run = 0;

    if (p.srv === side) {
      s.srvPts++; if (won) s.srvWon++;
      if (p.isBP) { s.bpFaced++; if (won) s.bpSaved++; }
    } else {
      s.retPts++; if (won) s.retWon++;
      if (p.isBP) { s.bpChances++; if (won) s.bpWon++; }
    }
  });

  rep.games.filter(g => g.winner).forEach(g => {
    if (g.server === side) { s.srvGames++; if (g.winner === side) s.holds++; }
    else                   { s.retGames++; if (g.winner === side) s.breaks++; }
    if (g.deuce) { s.deuceGames++; if (g.winner === side) s.deuceWon++; }
  });

  return s;
}

function addPointStats(into, s) {
  Object.keys(into).forEach(k => {
    into[k] = k === 'streak' ? Math.max(into[k], s[k]) : into[k] + s[k];
  });
  return into;
}

// Aggregate point stats for a player over a list of live-scored matches
function playerPointStats(pid, matches) {
  const agg = emptyPointStats();
  matches.forEach(m => {
    if (!m.points?.w) return;
    const side = m.team_a.includes(pid) ? 'A' : m.team_b.includes(pid) ? 'B' : null;
    if (side) addPointStats(agg, teamPointStats(replayMatch(m.points), side));
  });
  return agg;
}

function pct(n, d) { return d ? Math.round(100 * n / d) + '%' : '—'; }
function frac(n, d) { return d ? `${n}/${d}` : '—'; }

// ── RENDER: MOMENTUM CHART ───────────────────────────────────
// Running point difference; above the line = Team A ahead
function momentumSvg(rep) {
  const W = 320, H = 96, mid = H / 2;
  const n = rep.points.length;
  if (!n) return '';

  let d = 0, max = 1;
  const diffs = [0, ...rep.points.map(p => (d += p.w === 'A' ? 1 : -1))];
  diffs.forEach(v => { max = Math.max(max, Math.abs(v)); });

  const x = i => (i / n) * W;
  const y = v => mid - v * ((mid - 6) / max);
  const line = diffs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // Faint vertical line at each game boundary
  let i = 0;
  const marks = [];
  rep.games.forEach(g => {
    if (!g.winner) return;
    let a = 0, b = 0;
    while (i < n) {
      if (rep.points[i++].w === 'A') a++; else b++;
      if (gameWinner(a, b, rep.rule)) break;
    }
    if (i < n) marks.push(`<line x1="${x(i)}" x2="${x(i)}" y1="2" y2="${H - 2}" class="mo-game"/>`);
  });

  return `
  <svg viewBox="0 0 ${W} ${H}" class="momentum" preserveAspectRatio="none" role="img" aria-label="Momentum chart">
    <defs>
      <clipPath id="mo-top"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath>
      <clipPath id="mo-bot"><rect x="0" y="${mid}" width="${W}" height="${mid}"/></clipPath>
    </defs>
    ${marks.join('')}
    <line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="mo-axis"/>
    <polygon points="0,${mid} ${line} ${W},${mid}" class="mo-fill-a" clip-path="url(#mo-top)"/>
    <polygon points="0,${mid} ${line} ${W},${mid}" class="mo-fill-b" clip-path="url(#mo-bot)"/>
    <polyline points="${line}" class="mo-line" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

// ── RENDER: COMPARE ROWS ─────────────────────────────────────
function compareRow(label, a, b, valA, valB) {
  const tot = valA + valB;
  const wa  = tot ? (100 * valA / tot) : 50;
  return `
  <div class="cmp-row">
    <div class="cmp-vals"><span class="${valA > valB ? 'cmp-lead' : ''}">${a}</span><span class="cmp-label">${label}</span><span class="${valB > valA ? 'cmp-lead' : ''}">${b}</span></div>
    <div class="cmp-bar"><div class="cmp-bar-a" style="width:${wa}%"></div><div class="cmp-bar-b" style="width:${100 - wa}%"></div></div>
  </div>`;
}

// ── MATCH STATS MODAL ────────────────────────────────────────
function openMatchStats(id) {
  const m = App.matches.find(x => x.id === id);
  if (!m?.points?.w) return;

  const rep = replayMatch(m.points);
  const A = teamPointStats(rep, 'A'), B = teamPointStats(rep, 'B');
  const na = teamNames(m.team_a), nb = teamNames(m.team_b);

  const games = rep.games.filter(g => g.winner).map((g, i) => {
    const brk = g.winner !== g.server;
    return `<div class="game-chip ${g.winner === 'A' ? 'gc-a' : 'gc-b'}" title="Game ${i + 1}">
      <div class="gc-score">${g.score[0]}-${g.score[1]}</div>
      <div class="gc-tags">${g.server === 'A' ? '◀' : '▶'}${brk ? ' BRK' : ''}${g.deuce ? ' D' : ''}</div>
    </div>`;
  }).join('');

  const html = `
    <div class="ms-head">
      <div class="ms-team ms-a">${esc(na)}</div>
      <div class="ms-score">${m.score_a ?? 0}–${m.score_b ?? 0}</div>
      <div class="ms-team ms-b">${esc(nb)}</div>
    </div>
    <div class="text-sm text-muted" style="text-align:center;margin-bottom:12px">
      ${formatDate(m.date)} · ${rep.points.length} points · ${rep.rule === 'full' ? 'Full deuce' : 'Sudden death'}
    </div>

    <div class="ms-section">Momentum</div>
    ${momentumSvg(rep)}
    <div class="mo-legend"><span class="mo-key-a">▲ ${esc(shortName(na, 'Team A'))} ahead</span><span class="mo-key-b">▼ ${esc(shortName(nb, 'Team B'))} ahead</span></div>

    <div class="ms-section">Games <span class="text-muted" style="font-size:10px">◀▶ = server · BRK = break · D = went to deuce</span></div>
    <div class="game-strip">${games}</div>

    <div class="ms-section">Stats</div>
    ${compareRow('Points won',        A.pts,  B.pts,  A.pts,  B.pts)}
    ${compareRow('Serve points won',  pct(A.srvWon, A.srvPts), pct(B.srvWon, B.srvPts), A.srvWon / (A.srvPts || 1), B.srvWon / (B.srvPts || 1))}
    ${compareRow('Return points won', pct(A.retWon, A.retPts), pct(B.retWon, B.retPts), A.retWon / (A.retPts || 1), B.retWon / (B.retPts || 1))}
    ${compareRow('Service holds',     frac(A.holds, A.srvGames), frac(B.holds, B.srvGames), A.holds, B.holds)}
    ${compareRow('Breaks',            A.breaks, B.breaks, A.breaks, B.breaks)}
    ${compareRow('Break points won',  frac(A.bpWon, A.bpChances), frac(B.bpWon, B.bpChances), A.bpWon, B.bpWon)}
    ${compareRow('Break points saved', frac(A.bpSaved, A.bpFaced), frac(B.bpSaved, B.bpFaced), A.bpSaved, B.bpSaved)}
    ${compareRow('Deuce games won',   A.deuceWon, B.deuceWon, A.deuceWon, B.deuceWon)}
    ${compareRow('Longest point run', A.streak, B.streak, A.streak, B.streak)}
  `;
  openSheet(html);
}

// ── PLAYER STATS SHEET ───────────────────────────────────────
// record: { wins, losses, line } summary from the caller's standings
function openPlayerStats(pid, matches, record, scopeLabel) {
  const p = player(pid);
  if (!p) return;
  const s = playerPointStats(pid, matches);

  const stat = (label, val, sub = '') =>
    `<div class="ps-tile"><div class="ps-val">${val}</div><div class="ps-label">${label}</div>${sub ? `<div class="ps-sub">${sub}</div>` : ''}</div>`;

  const pointSection = s.matches
    ? `<div class="ps-grid">
        ${stat('Points won',      pct(s.pts, s.total),       `${s.pts}/${s.total}`)}
        ${stat('Serve pts won',   pct(s.srvWon, s.srvPts))}
        ${stat('Return pts won',  pct(s.retWon, s.retPts))}
        ${stat('Hold %',          pct(s.holds, s.srvGames),  frac(s.holds, s.srvGames))}
        ${stat('Break %',         pct(s.breaks, s.retGames), frac(s.breaks, s.retGames))}
        ${stat('BP converted',    pct(s.bpWon, s.bpChances), frac(s.bpWon, s.bpChances))}
        ${stat('BP saved',        pct(s.bpSaved, s.bpFaced), frac(s.bpSaved, s.bpFaced))}
        ${stat('Deuce games won', pct(s.deuceWon, s.deuceGames), frac(s.deuceWon, s.deuceGames))}
        ${stat('Best point run',  s.streak)}
      </div>
      <p class="text-sm text-muted mt-8">From ${s.matches} live-scored match${s.matches === 1 ? '' : 'es'}. Doubles stats count for both partners.</p>`
    : `<div class="empty" style="padding:12px 0">No live-scored matches yet.<br>Score a match with <strong>Live</strong> to unlock serve, break and deuce stats.</div>`;

  openSheet(`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      ${playerAvatar(p, 48)}
      <div>
        <div class="modal-title" style="margin-bottom:2px">${esc(p.name)}</div>
        <div class="text-sm text-muted">${esc(record || '')}</div>
      </div>
    </div>
    <div class="ms-section">Point stats · ${esc(scopeLabel || '')}</div>
    ${pointSection}
  `);
}
