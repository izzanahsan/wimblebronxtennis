// ── AMERICANO: ONE ROUND AT A TIME ───────────────────────────
// The next round is planned from what has been played so far: whoever has
// played least plays next, and partners and opponents repeat as little as possible.

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// history: [{ a: [ids], b: [ids] }] of matches already planned or played
// returns [{ a, b }] one per court
function nextRound(ids, courts, history, tries = 4000) {
  const key = (x, y) => (x < y ? `${x}-${y}` : `${y}-${x}`);
  const played = new Map(ids.map(id => [id, 0])), partner = {}, opp = {};
  for (const m of history) {
    for (const id of [...m.a, ...m.b]) if (played.has(id)) played.set(id, played.get(id) + 1);
    for (const t of [m.a, m.b]) if (t.length === 2) partner[key(t[0], t[1])] = (partner[key(t[0], t[1])] || 0) + 1;
    for (const x of m.a) for (const y of m.b) opp[key(x, y)] = (opp[key(x, y)] || 0) + 1;
  }
  const n = Math.min(courts, Math.floor(ids.length / 4)) * 4;
  let best = [], bestCost = Infinity;
  for (let t = 0; t < tries && bestCost > 0; t++) {
    // least-played first; the shuffle breaks ties fairly (sort is stable)
    const on = shuffle(shuffle(ids).sort((x, y) => played.get(x) - played.get(y)).slice(0, n));
    const ms = [];
    let cost = 0;
    for (let i = 0; i < n; i += 4) {
      const a = [on[i], on[i + 1]], b = [on[i + 2], on[i + 3]];
      cost += 10 * ((partner[key(a[0], a[1])] || 0) + (partner[key(b[0], b[1])] || 0));
      for (const x of a) for (const y of b) cost += opp[key(x, y)] || 0;
      ms.push({ a, b });
    }
    if (cost < bestCost) { best = ms; bestCost = cost; }
  }
  return best;
}

function americanoStandings(playerIds, matches) {
  const stats = new Map();
  for (const id of playerIds) {
    stats.set(id, {
      id,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      diff: 0
    });
  }

  if (Array.isArray(matches)) {
    for (const m of matches) {
      if (
        !m ||
        typeof m.scoreA !== 'number' ||
        typeof m.scoreB !== 'number' ||
        Number.isNaN(m.scoreA) ||
        Number.isNaN(m.scoreB)
      ) {
        continue;
      }

      const sA = m.scoreA;
      const sB = m.scoreB;
      const isWinA = sA > sB;
      const isDraw = sA === sB;
      const isWinB = sB > sA;

      if (Array.isArray(m.teamA)) {
        for (const pid of m.teamA) {
          const entry = stats.get(pid);
          if (entry) {
            entry.points += sA;
            entry.played += 1;
            entry.diff += sA - sB;
            if (isWinA) entry.wins += 1;
            else if (isDraw) entry.draws += 1;
            else entry.losses += 1;
          }
        }
      }

      if (Array.isArray(m.teamB)) {
        for (const pid of m.teamB) {
          const entry = stats.get(pid);
          if (entry) {
            entry.points += sB;
            entry.played += 1;
            entry.diff += sB - sA;
            if (isWinB) entry.wins += 1;
            else if (isDraw) entry.draws += 1;
            else entry.losses += 1;
          }
        }
      }
    }
  }

  const result = Array.from(stats.values());
  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return a.id - b.id;
  });

  return result;
}
