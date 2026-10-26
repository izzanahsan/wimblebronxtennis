// Scoring and ranking rules. Run: node tests/rules.test.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const on = () => {};
const ctx = { document: { addEventListener: on }, window: { addEventListener: on }, supabase: { createClient: () => ({}) } };
vm.createContext(ctx);
for (const f of ['config.js', 'stats.js', 'utils.js', 'scorer.js']) vm.runInContext(fs.readFileSync(`${__dirname}/../app/js/${f}`, 'utf8'), ctx);
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

// Ties share a rank
const byPts = (a, b) => a === b;
assert.deepEqual([...tiedRanks([9, 7, 5], byPts)], [1, 2, 3]);
assert.deepEqual([...tiedRanks([9, 9, 5], byPts)], [1, 1, 3]);
assert.deepEqual([...tiedRanks([4, 4, 4], byPts)], [1, 1, 1]);

console.log('rules: all passed');
