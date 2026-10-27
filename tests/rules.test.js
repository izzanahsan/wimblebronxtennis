// Scoring and ranking rules. Run: node tests/rules.test.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const on = () => {};
const ctx = { document: { addEventListener: on }, window: { addEventListener: on }, supabase: { createClient: () => ({}) } };
vm.createContext(ctx);
for (const f of ['config.js', 'stats.js', 'utils.js', 'scorer.js', 'americano.js']) vm.runInContext(fs.readFileSync(`${__dirname}/../app/js/${f}`, 'utf8'), ctx);
const { gameWinner, scoreFromLog, tiedRanks } = ctx;

// Games
assert.equal(gameWinner(4, 2, 'full'), 'A');                       // 40-30 → game
assert.equal(gameWinner(3, 3, 'sudden'), null);                    // deuce, deciding point next
assert.equal(gameWinner(3, 4, 'sudden'), 'B');                     // deciding point won
assert.equal(gameWinner(4, 3, 'full'), null);                      // advantage only
assert.equal(gameWinner(5, 3, 'full'), 'A');                       // advantage converted

// Status line comes from the score alone (no serve guessing)
const { pointLabels } = ctx;
assert.equal(pointLabels(3, 1, 'full', 'Ana', 'Ben').status, 'Game point Ana');
assert.equal(pointLabels(2, 3, 'full', 'Ana', 'Ben').status, 'Game point Ben');
assert.equal(pointLabels(4, 3, 'full', 'Ana', 'Ben').status, 'Advantage Ana');
assert.match(pointLabels(3, 3, 'sudden', 'Ana', 'Ben').status, /Deciding point/);
assert.equal(pointLabels(1, 1, 'full', 'Ana', 'Ben').status, '');

// A point log replays into games and current points
assert.deepEqual({ ...scoreFromLog({ w: 'AAAA' + 'BB', deuce: 'full' }) }, { gA: 1, gB: 0, a: 0, b: 2 });
assert.deepEqual({ ...scoreFromLog({ w: 'AAABBBA' + 'B' + 'AA', deuce: 'full' }) }, { gA: 1, gB: 0, a: 0, b: 0 });

// Games fixed by hand add on top of the log and turn stats off
const { hasStats } = ctx;
assert.deepEqual({ ...scoreFromLog({ w: 'AAAA' + 'B', deuce: 'full', adj: [1, 2] }) }, { gA: 2, gB: 2, a: 0, b: 1 });
assert.equal(hasStats({ points: { w: 'AB' } }), true);
assert.equal(hasStats({ points: { w: 'AB', adj: [0, 1] } }), false);
assert.equal(hasStats({ points: null }), false);

// Ties share a rank
const byPts = (a, b) => a === b;
assert.deepEqual([...tiedRanks([9, 7, 5], byPts)], [1, 2, 3]);
assert.deepEqual([...tiedRanks([9, 9, 5], byPts)], [1, 1, 3]);
assert.deepEqual([...tiedRanks([4, 4, 4], byPts)], [1, 1, 1]);

// Next round: everyone on court once, fair sit-outs, no partner repeat when avoidable
const { nextRound, americanoStandings } = ctx;
const ids9 = [1, 2, 3, 4, 5, 6, 7, 8, 9], hist = [];
for (let r = 0; r < 9; r++) {
  const round = nextRound(ids9, 2, hist);
  const on = round.flatMap(m => [...m.a, ...m.b]);
  assert.equal(on.length, 8);
  assert.equal(new Set(on).size, 8);                                  // nobody twice in a round
  hist.push(...round);
  const games = ids9.map(id => hist.filter(m => [...m.a, ...m.b].includes(id)).length);
  assert.ok(Math.max(...games) - Math.min(...games) <= 1);            // sit-outs rotate
}
const r1 = nextRound([1, 2, 3, 4, 5, 6, 7, 8], 2, []);
const pairs = new Set(r1.flatMap(m => [m.a, m.b]).map(t => [...t].sort().join('-')));
nextRound([1, 2, 3, 4, 5, 6, 7, 8], 2, r1).flatMap(m => [m.a, m.b])
  .forEach(t => assert.ok(!pairs.has([...t].sort().join('-'))));      // new partners in round 2

// Standings: games won, then wins
const st = americanoStandings([1, 2, 3, 4], [
  { teamA: [1, 2], teamB: [3, 4], scoreA: 21, scoreB: 15 },
  { teamA: [1, 3], teamB: [2, 4], scoreA: 10, scoreB: 20 }
]);
assert.equal(st[0].id, 2); assert.equal(st[0].points, 41); assert.equal(st[3].id, 3);

console.log('rules: all passed');
