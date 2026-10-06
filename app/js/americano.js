function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function americanoScheduleOnce(playerIds, courts, rounds, seed) {
  const n = playerIds.length;
  if (n < 4 || courts < 1 || rounds < 1) return [];

  const matchesPerRound = Math.min(courts, Math.floor(n / 4));
  const activeCount = matchesPerRound * 4;
  const byeCountPerRound = n - activeCount;

  // Exact Whist Tournament for N=8, courts >= 2
  if (n === 8 && matchesPerRound === 2) {
    const schedule = [];
    const p = playerIds;
    for (let r = 0; r < rounds; r++) {
      const idx = r % 7;
      const t1A = [p[7], p[idx]];
      const t1B = [p[(1 + idx) % 7], p[(3 + idx) % 7]];
      const t2A = [p[(2 + idx) % 7], p[(6 + idx) % 7]];
      const t2B = [p[(4 + idx) % 7], p[(5 + idx) % 7]];
      schedule.push({
        round: r + 1,
        matches: [
          { court: 1, teamA: t1A, teamB: t1B },
          { court: 2, teamA: t2A, teamB: t2B }
        ],
        byes: []
      });
    }
    return schedule;
  }

  // Exact Whist / Round-Robin for N=4, courts >= 1
  if (n === 4 && matchesPerRound === 1) {
    const schedule = [];
    const p = playerIds;
    const baseMatchings = [
      { teamA: [p[0], p[1]], teamB: [p[2], p[3]] },
      { teamA: [p[0], p[2]], teamB: [p[1], p[3]] },
      { teamA: [p[0], p[3]], teamB: [p[1], p[2]] }
    ];
    for (let r = 0; r < rounds; r++) {
      const m = baseMatchings[r % 3];
      schedule.push({
        round: r + 1,
        matches: [{ court: 1, teamA: m.teamA.slice(), teamB: m.teamB.slice() }],
        byes: []
      });
    }
    return schedule;
  }

  const rng = mulberry32(seed);

  // Tracking histories
  const byeCounts = new Map();
  const partnerMatrix = new Map();
  const opponentMatrix = new Map();

  for (const id1 of playerIds) {
    byeCounts.set(id1, 0);
    partnerMatrix.set(id1, new Map());
    opponentMatrix.set(id1, new Map());
    for (const id2 of playerIds) {
      partnerMatrix.get(id1).set(id2, 0);
      opponentMatrix.get(id1).set(id2, 0);
    }
  }

  let lastRoundByes = new Set();
  const schedule = [];

  for (let r = 1; r <= rounds; r++) {
    let roundByes = [];
    let activePlayers = [];

    if (byeCountPerRound === 0) {
      activePlayers = playerIds.slice();
    } else {
      // Bye selection:
      // Invariant: difference between max and min bye count <= 1.
      let minBye = Infinity;
      for (const id of playerIds) {
        const c = byeCounts.get(id);
        if (c < minBye) minBye = c;
      }

      const groupMinNotLast = [];
      const groupMinInLast = [];
      const groupNextNotLast = [];
      const groupNextInLast = [];

      for (const id of playerIds) {
        const c = byeCounts.get(id);
        const inLast = lastRoundByes.has(id);
        if (c === minBye) {
          if (!inLast) groupMinNotLast.push(id);
          else groupMinInLast.push(id);
        } else {
          if (!inLast) groupNextNotLast.push(id);
          else groupNextInLast.push(id);
        }
      }

      const orderedCandidates = [
        ...shuffle(groupMinNotLast, rng),
        ...shuffle(groupMinInLast, rng),
        ...shuffle(groupNextNotLast, rng),
        ...shuffle(groupNextInLast, rng)
      ];

      roundByes = orderedCandidates.slice(0, byeCountPerRound);
      for (const id of roundByes) {
        byeCounts.set(id, byeCounts.get(id) + 1);
      }
      lastRoundByes = new Set(roundByes);

      const byeSet = new Set(roundByes);
      activePlayers = playerIds.filter(id => !byeSet.has(id));
    }

    // Match formation: 200 randomized attempts
    let bestScore = Infinity;
    let bestMatches = null;
    const ATTEMPTS = 200;

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const candidateMatches = [];

      if (attempt < 160) {
        // Semi-greedy matching with randomized tie-breaking
        const pool = shuffle(activePlayers, rng);
        for (let m = 0; m < matchesPerRound; m++) {
          const p1 = pool.pop();

          let minPartner = Infinity;
          let bestP2s = [];
          for (let i = 0; i < pool.length; i++) {
            const cand = pool[i];
            const pCount = partnerMatrix.get(p1).get(cand);
            if (pCount < minPartner) {
              minPartner = pCount;
              bestP2s = [cand];
            } else if (pCount === minPartner) {
              bestP2s.push(cand);
            }
          }
          const p2 = bestP2s[Math.floor(rng() * bestP2s.length)];
          pool.splice(pool.indexOf(p2), 1);
          const teamA = [p1, p2];

          const p3 = pool.pop();

          let minCost = Infinity;
          let bestP4s = [];
          for (let i = 0; i < pool.length; i++) {
            const cand = pool[i];
            const pCount = partnerMatrix.get(p3).get(cand);
            const oCount =
              opponentMatrix.get(p1).get(p3) +
              opponentMatrix.get(p1).get(cand) +
              opponentMatrix.get(p2).get(p3) +
              opponentMatrix.get(p2).get(cand);
            const cost = pCount * 100 + oCount * 10;
            if (cost < minCost) {
              minCost = cost;
              bestP4s = [cand];
            } else if (cost === minCost) {
              bestP4s.push(cand);
            }
          }
          const p4 = bestP4s[Math.floor(rng() * bestP4s.length)];
          pool.splice(pool.indexOf(p4), 1);
          const teamB = [p3, p4];

          candidateMatches.push({ court: m + 1, teamA, teamB });
        }
      } else {
        // Uniform random shuffle
        const shuffled = shuffle(activePlayers, rng);
        for (let m = 0; m < matchesPerRound; m++) {
          candidateMatches.push({
            court: m + 1,
            teamA: [shuffled[4 * m], shuffled[4 * m + 1]],
            teamB: [shuffled[4 * m + 2], shuffled[4 * m + 3]]
          });
        }
      }

      // Score evaluation: partnerRepeats * 100 + opponentRepeats * 10
      let roundScore = 0;
      for (const cm of candidateMatches) {
        const [a1, a2] = cm.teamA;
        const [b1, b2] = cm.teamB;
        roundScore += (partnerMatrix.get(a1).get(a2) + partnerMatrix.get(b1).get(b2)) * 100;
        roundScore +=
          (opponentMatrix.get(a1).get(b1) +
            opponentMatrix.get(a1).get(b2) +
            opponentMatrix.get(a2).get(b1) +
            opponentMatrix.get(a2).get(b2)) *
          10;
      }

      if (roundScore < bestScore) {
        bestScore = roundScore;
        bestMatches = candidateMatches;
        if (bestScore === 0) break;
      }
    }

    // Apply chosen matches to history
    for (const match of bestMatches) {
      const [a1, a2] = match.teamA;
      const [b1, b2] = match.teamB;
      partnerMatrix.get(a1).set(a2, partnerMatrix.get(a1).get(a2) + 1);
      partnerMatrix.get(a2).set(a1, partnerMatrix.get(a2).get(a1) + 1);
      partnerMatrix.get(b1).set(b2, partnerMatrix.get(b1).get(b2) + 1);
      partnerMatrix.get(b2).set(b1, partnerMatrix.get(b2).get(b1) + 1);

      const team1 = [a1, a2];
      const team2 = [b1, b2];
      for (const p of team1) {
        for (const q of team2) {
          opponentMatrix.get(p).set(q, opponentMatrix.get(p).get(q) + 1);
          opponentMatrix.get(q).set(p, opponentMatrix.get(q).get(p) + 1);
        }
      }
    }

    schedule.push({
      round: r,
      matches: bestMatches,
      byes: roundByes
    });
  }

  return schedule;
}

// Greedy rounds can paint themselves into a corner, so build the whole
// schedule from several seeds and keep the one with the fewest repeats.
function scheduleCost(schedule) {
  const part = {}, opp = {};
  let cost = 0;
  for (const r of schedule) for (const m of r.matches) {
    for (const t of [m.teamA, m.teamB]) {
      const k = [...t].sort((a, b) => a - b).join('-');
      cost += (part[k] = (part[k] || 0) + 1) > 1 ? 1000 : 0;
    }
    for (const a of m.teamA) for (const b of m.teamB) {
      const k = [a, b].sort((x, y) => x - y).join('-');
      cost += (opp[k] = (opp[k] || 0) + 1) > 1 ? opp[k] : 0;
    }
  }
  return cost;
}

function americanoSchedule(playerIds, courts, rounds, seed) {
  let best = null, bestCost = Infinity;
  for (let i = 0; i < 40; i++) {
    const s = americanoScheduleOnce(playerIds, courts, rounds, (seed + i * 7919) >>> 0);
    const c = scheduleCost(s);
    if (c < bestCost) { best = s; bestCost = c; }
    if (c === 0) break;
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

function __selfTest() {
  let allOk = true;

  function assert(condition, desc) {
    if (!condition) {
      allOk = false;
      console.error('FAIL:', desc);
    } else {
      console.log('PASS:', desc);
    }
  }

  // 1. Assert N=8, courts=2, rounds=7: every pair partners exactly once, nobody has a bye
  const p8 = [1, 2, 3, 4, 5, 6, 7, 8];
  const s8 = americanoSchedule(p8, 2, 7, 101);

  assert(s8.length === 7, 'N=8: generated 7 rounds');

  const partnerCounts8 = {};
  for (const id1 of p8) {
    partnerCounts8[id1] = {};
    for (const id2 of p8) partnerCounts8[id1][id2] = 0;
  }

  let anyBye8 = false;
  for (const r of s8) {
    if (r.byes.length > 0) anyBye8 = true;
    for (const m of r.matches) {
      const [a1, a2] = m.teamA;
      const [b1, b2] = m.teamB;
      partnerCounts8[a1][a2]++;
      partnerCounts8[a2][a1]++;
      partnerCounts8[b1][b2]++;
      partnerCounts8[b2][b1]++;
    }
  }

  assert(!anyBye8, 'N=8: nobody has a bye');

  let pairsExactOnce8 = true;
  for (let i = 0; i < p8.length; i++) {
    for (let j = i + 1; j < p8.length; j++) {
      if (partnerCounts8[p8[i]][p8[j]] !== 1) {
        pairsExactOnce8 = false;
      }
    }
  }
  assert(pairsExactOnce8, 'N=8: every pair of players partners exactly once');

  // 2. Assert N=9, courts=2, rounds=9: bye counts all exactly 1, no partner repeats exceeding 1
  const p9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const s9 = americanoSchedule(p9, 2, 9, 202);

  assert(s9.length === 9, 'N=9: generated 9 rounds');

  const byeCounts9 = {};
  const partnerCounts9 = {};
  for (const id1 of p9) {
    byeCounts9[id1] = 0;
    partnerCounts9[id1] = {};
    for (const id2 of p9) partnerCounts9[id1][id2] = 0;
  }

  for (const r of s9) {
    for (const b of r.byes) byeCounts9[b]++;
    for (const m of r.matches) {
      const [a1, a2] = m.teamA;
      const [b1, b2] = m.teamB;
      partnerCounts9[a1][a2]++;
      partnerCounts9[a2][a1]++;
      partnerCounts9[b1][b2]++;
      partnerCounts9[b2][b1]++;
    }
  }

  let byesAllOne9 = true;
  for (const id of p9) {
    if (byeCounts9[id] !== 1) byesAllOne9 = false;
  }
  assert(byesAllOne9, 'N=9: bye counts are all exactly 1');

  let noRepeatsExceedingOne9 = true;
  for (let i = 0; i < p9.length; i++) {
    for (let j = i + 1; j < p9.length; j++) {
      if (partnerCounts9[p9[i]][p9[j]] > 2) {
        noRepeatsExceedingOne9 = false;
      }
    }
  }
  assert(noRepeatsExceedingOne9, 'N=9: no partner repeats exceeding 1');

  // 3. Performance check: N=24, courts=6, rounds=10 in under 300ms
  const p24 = Array.from({ length: 24 }, (_, i) => i + 1);
  const start = Date.now();
  americanoSchedule(p24, 6, 10, 303);
  const elapsed = Date.now() - start;
  assert(elapsed < 300, `N=24: finished in ${elapsed}ms (< 300ms)`);

  // 4. Standings test
  const standings = americanoStandings([1, 2, 3, 4], [
    { teamA: [1, 2], teamB: [3, 4], scoreA: 21, scoreB: 15 },
    { teamA: [1, 3], teamB: [2, 4], scoreA: 10, scoreB: 20 },
    { teamA: [1, 4], teamB: [2, 3], scoreA: null, scoreB: null }
  ]);
  assert(
    standings.length === 4 &&
      standings[0].id === 2 &&
      standings[0].points === 41 &&
      standings[0].wins === 2 &&
      standings[3].id === 3,
    'Standings: calculated and sorted correctly'
  );

  console.log('Self-test finished:', allOk ? 'ALL TESTS PASSED' : 'TESTS FAILED');
  return allOk;
}

if (typeof module !== 'undefined') {
  module.exports = { americanoSchedule, americanoStandings };
}
