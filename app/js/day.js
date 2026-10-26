// ── AMERICANO MATCH DAY ──────────────────────────────────────
const DAY_TABS = [
  { id: 'rounds',    label: 'Rounds',    render: () => renderRounds() },
  { id: 'standings', label: 'Standings', render: () => renderDayStandings() },
  { id: 'share',     label: 'Share',     render: () => renderShare() },
  { id: 'manage',    label: 'Manage',    render: () => renderDayManage(), admin: true }
];

// Plan rounds fromRound … fromRound+count-1, one at a time, each from what came before
function buildRounds(ids, fromRound, count) {
  const courts = App.event?.settings?.courts || 1;
  const history = App.matches.filter(m => m.round && m.round < fromRound).map(m => ({ a: m.team_a, b: m.team_b }));
  const out = [];
  for (let r = fromRound; r < fromRound + count; r++) {
    nextRound(ids, courts, history).forEach((m, i) => {
      history.push(m);
      out.push({ round: r, court: i + 1, team_a: m.a, team_b: m.b });
    });
  }
  return out;
}

function dayRounds() {
  const byRound = {};
  App.matches.filter(m => m.round).forEach(m => { (byRound[m.round] ||= []).push(m); });
  return Object.keys(byRound).map(Number).sort((a, b) => a - b)
    .map(r => ({ round: r, matches: byRound[r].sort((a, b) => a.court - b.court) }));
}

function currentRound() { return dayRounds().find(r => r.matches.some(m => m.status !== 'done')); }

// First round from which nothing has started (safe to regenerate)
function firstFreeRound() {
  const rounds = dayRounds();
  let free = (rounds.at(-1)?.round || 0) + 1;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].matches.every(m => m.status === 'scheduled')) free = rounds[i].round; else break;
  }
  return free;
}

// The round after the one being played: player changes never move people already called to court
function nextOpenRound() {
  const cur = currentRound();
  return cur ? Math.max(cur.round + 1, firstFreeRound()) : firstFreeRound();
}

async function regenerateRemaining(totalRounds = App.event.settings.rounds, from = nextOpenRound()) {
  const count = totalRounds - from + 1;
  const ids = App.players.filter(p => p.active).map(p => p.id);
  if (count > 0 && ids.length < 4) { toast('Need at least 4 players switched on'); return; }
  await apiOp('replace_schedule', { from_round: from, matches: count > 0 ? buildRounds(ids, from, count) : [] });
}

// ── ROUNDS ───────────────────────────────────────────────────
// Only the round being played is shown in full; finished rounds sit below it
function renderRounds() {
  const rounds = dayRounds();
  const el = document.getElementById('view');
  if (!rounds.length) { el.innerHTML = '<div class="empty">No rounds yet.</div>'; return; }

  const current = currentRound();
  const earlier = rounds.filter(r => r.matches.every(m => m.status === 'done') && (!current || r.round < current.round)).reverse();

  el.innerHTML = `
    ${!App.isAdmin && current ? `<p class="intro-note">Americano: partners change every round. Find your name to see your court.</p>` : ''}
    ${current ? roundCardHtml(current, true) : roundDoneHtml(rounds.at(-1).round)}
    ${earlier.length ? `<h2 class="section-title mt-12">Earlier rounds</h2>${earlier.map(r => roundCardHtml(r, false)).join('')}` : ''}
  `;
}

// Between rounds: standings so far, then play on or finish with the story
function roundDoneHtml(last) {
  const rows = dayStandings().filter(r => r.played);
  const ranks = tiedRanks(rows, (a, b) => a.points === b.points && a.wins === b.wins && a.diff === b.diff);
  const top = rows.map((r, i) => ({ r, rank: ranks[i] })).filter(x => x.rank <= 3);
  return `
  <div class="card day-complete">
    <div class="dc-head">${logoImg(40)}<div><div class="dc-title">Round ${last} done</div><div class="text-sm text-muted">Standings so far</div></div></div>
    ${top.map(({ r, rank }) => `
      <div class="dc-row">
        <span class="lb-rank top${rank}">${rank}</span>
        <span class="dc-name">${esc(player(r.id)?.name)}</span>
        <span class="dc-pts">${r.points}<small> games</small></span>
      </div>`).join('')}
    ${App.isAdmin
      ? `<button class="btn btn-green mt-12" onclick="dayAddRounds(1)">Start round ${last + 1}</button>
         <a class="btn btn-outline mt-8" href="#/e/${App.slug}/share">End Session</a>`
      : `<p class="text-sm text-muted mt-12">Waiting for the organizer to start the next round.</p>
         <a class="btn btn-outline mt-8" href="#/e/${App.slug}/share">See the Instagram story</a>`}
  </div>`;
}

function roundCardHtml(r, isCurrent) {
  const playing = new Set(r.matches.flatMap(m => [...m.team_a, ...m.team_b]));
  const byes = App.players.filter(p => p.active && !playing.has(p.id));
  const started = r.matches.some(m => m.status !== 'scheduled');
  const canSwap = isCurrent && App.isAdmin && r.matches.some(m => m.status === 'scheduled');

  return `
  <section class="card round-card ${isCurrent ? 'current' : 'done'}" id="round-${r.round}" aria-labelledby="rt-${r.round}">
    <div class="flex-between mb-8">
      <h2 class="card-title" id="rt-${r.round}" style="margin:0">Round ${r.round}</h2>
      <span class="round-state">${isCurrent ? (started ? 'Now playing' : 'Up next') : 'Done'}</span>
    </div>
    ${r.matches.map(m => matchRowHtml(m, isCurrent)).join('')}
    ${isCurrent && byes.length ? `<div class="text-sm text-muted mt-8">Sitting out: ${byes.map(p => esc(p.name)).join(', ')}</div>` : ''}
    ${canSwap ? `<button class="btn btn-outline mt-12" onclick="openSwap(${r.round})">Someone missing? Swap a player</button>` : ''}
  </section>`;
}

function matchRowHtml(m, isCurrent) {
  const done = m.status === 'done', live = m.status === 'live';
  const aWin = done && m.score_a > m.score_b, bWin = done && m.score_b > m.score_a;
  const score = done || live
    ? `<span class="${aWin ? 'score-win' : ''}">${m.score_a ?? 0}</span><span class="text-muted">–</span><span class="${bWin ? 'score-win' : ''}">${m.score_b ?? 0}</span>`
    : '<span class="text-muted">vs</span>';

  let action = '';
  if (App.isAdmin && !done && isCurrent) {
    action = `<div class="mr-actions">
      <button class="btn-mini" onclick="openQuickScore(${m.id})">Enter score</button>
      <a class="btn-mini btn-mini-live" href="#/e/${App.slug}/score/${m.id}">${live ? 'Continue live' : 'Score live'}</a>
    </div>`;
  } else if (live) {
    action = `<div class="mr-actions"><a class="btn-mini btn-mini-live" href="#/e/${App.slug}/score/${m.id}"><span class="live-dot-sm" aria-hidden="true"></span>Watch live</a></div>`;
  } else if (done && (m.points?.w || App.isAdmin)) {
    action = `<div class="mr-actions">
      ${m.points?.w ? `<button class="btn-mini" onclick="openMatchStats(${m.id})">${ICONS.stats(16)}Stats</button>` : ''}
      ${App.isAdmin ? `<button class="btn-mini" onclick="openQuickScore(${m.id})">Edit</button>` : ''}
    </div>`;
  }

  return `
  <div class="match-row ${live ? 'is-live' : ''}">
    <div class="mr-court">C${m.court}</div>
    <div class="mr-team mr-a ${aWin ? 'win' : ''}">${esc(teamNames(m.team_a))}</div>
    <div class="mr-score">${score}</div>
    <div class="mr-team mr-right ${bWin ? 'win' : ''}">${esc(teamNames(m.team_b))}</div>
    ${action}
  </div>`;
}

// ── SWAP A PLAYER (no-show) ──────────────────────────────────
// Only in matches of the current round that haven't started
function openSwap(round) {
  const r = dayRounds().find(x => x.round === round);
  const ids = r.matches.filter(m => m.status === 'scheduled').flatMap(m => [...m.team_a, ...m.team_b]);
  openSheet(`
    <div class="modal-title">Swap a player</div>
    <p class="confirm-body">Who isn't here?</p>
    <div class="player-select">${ids.map(id => `<button type="button" class="p-tag" onclick="openSwapPick(${round}, ${id})">${esc(player(id)?.name)}</button>`).join('')}</div>`);
}

function openSwapPick(round, outId) {
  const r = dayRounds().find(x => x.round === round);
  const busy = new Set(r.matches.flatMap(m => [...m.team_a, ...m.team_b]));
  const free = App.players.filter(p => !busy.has(p.id));
  openSheet(`
    <div class="modal-title">Who plays instead of ${esc(player(outId)?.name)}?</div>
    ${free.length
      ? `<div class="player-select">${free.map(p => `<button type="button" class="p-tag" onclick="swapPlayer(${round}, ${outId}, ${p.id})">${esc(p.name)}</button>`).join('')}</div>`
      : `<p class="confirm-body">Everyone is already playing this round. Add a late arrival in Manage first.</p>`}
    <button class="btn btn-outline mt-12" onclick="openSwap(${round})">Back</button>`);
}

async function swapPlayer(round, outId, inId) {
  const m = dayRounds().find(x => x.round === round)?.matches
    .find(x => x.status === 'scheduled' && [...x.team_a, ...x.team_b].includes(outId));
  if (!m) { closeSheet(); toast('That match has already started'); return; }
  const rep = t => t.map(id => (id === outId ? inId : id));
  await apiOp('save_match', { id: m.id, team_a: rep(m.team_a), team_b: rep(m.team_b) });
  // The no-show sits out the next rounds; the stand-in is in from now on
  if (player(outId)?.active) await apiOp('update_player', { id: outId, active: false });
  if (!player(inId)?.active) await apiOp('update_player', { id: inId, active: true });
  closeSheet();
  toast(`${player(inId)?.name} plays instead of ${player(outId)?.name}. ${player(outId)?.name} is switched off for the next rounds.`, 4000);
  rerender();
}

// ── STANDINGS ────────────────────────────────────────────────
function dayStandings() {
  const played = App.matches.filter(m => m.status === 'done')
    .map(m => ({ teamA: m.team_a, teamB: m.team_b, scoreA: m.score_a, scoreB: m.score_b }));
  const inPlay = new Set(App.matches.flatMap(m => [...m.team_a, ...m.team_b]));
  const ids = App.players.filter(p => p.active || inPlay.has(p.id)).map(p => p.id);
  return americanoStandings(ids, played);
}

function renderDayStandings() {
  const rows = dayStandings();
  const el = document.getElementById('view');
  const live = App.matches.filter(m => m.status === 'live');

  el.innerHTML = `
    ${live.map(liveCardHtml).join('')}
    <h2 class="section-title">Standings <span class="text-sm text-muted">· games won</span></h2>
    <div class="card">
    ${(() => {
      const ranks = tiedRanks(rows, (a, b) => a.points === b.points && a.wins === b.wins && a.diff === b.diff);
      return rows.map((r, i) => {
      const p = player(r.id);
      const rank = ranks[i];
      const medal = r.points > 0 && rank <= 3 ? `top${rank}` : '';
      const diff = r.diff > 0 ? `+${r.diff}` : r.diff === 0 ? '±0' : r.diff;
      const record = `${r.wins}W ${r.draws ? r.draws + 'D ' : ''}${r.losses}L · ${diff}`;
      return `
      <div class="lb-row" role="button" tabindex="0" aria-label="${rank}. ${esc(p?.name)}, ${r.points} games won. Open stats" onclick="openPlayerStats(${r.id}, App.matches, '${record} · ${r.points} games won', 'Today')">
        <div class="lb-rank ${medal}">${rank}</div>
        ${playerAvatar(p, 34)}
        <div class="lb-info">
          <div class="lb-name">${esc(p?.name)}</div>
          <div class="lb-sub">${record} · ${r.played} played</div>
        </div>
        <div class="lb-pts">${r.points}</div>
      </div>`;
    }).join(''); })()}
    </div>
    <p class="text-sm text-muted">Ranked by total games won, then wins, then game difference. Tap a player for stats.</p>
  `;
}

// ── MANAGE (organizer) ───────────────────────────────────────
function renderDayManage() {
  const s = App.event.settings;
  const cur = currentRound();
  const curOpen = cur && cur.matches.every(m => m.status === 'scheduled');
  document.getElementById('view').innerHTML = `
    <div class="card">
      <div class="card-title">Players</div>
      <p class="text-sm text-muted mb-8">Changes here count from the next round. For someone missing right now, use "Swap a player" on the Rounds tab.</p>
      ${App.players.map(p => `
        <div class="avail-row">
          <div style="opacity:${p.active ? 1 : .4}">${playerAvatar(p, 30)}</div>
          <div class="avail-name" style="opacity:${p.active ? 1 : .4}">${esc(p.name)}</div>
          <label class="toggle">
            <input type="checkbox" aria-label="${esc(p.name)} is playing" ${p.active ? 'checked' : ''} onchange="dayTogglePlayer(${p.id}, this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:10px">
        <input class="input" id="m-new-player" placeholder="Late arrival's name" aria-label="Late arrival's name" maxlength="24" onkeydown="if(event.key==='Enter')dayAddPlayer()">
        <button class="btn btn-primary" style="width:auto" onclick="dayAddPlayer()">Add</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Rounds</div>
      <p class="text-sm text-muted mb-8">${s.courts} court${s.courts > 1 ? 's' : ''} · ${esc(formatLabel(s.scoring))}${cur ? ` · Round ${cur.round} ${curOpen ? 'up next' : 'playing'}` : ''}</p>
      <button class="btn btn-outline btn-icon" onclick="dayReshuffle()" ${curOpen ? '' : 'disabled'}>${ICONS.shuffle(16)}Reshuffle this round</button>
      <button class="btn btn-outline mt-8" onclick="dayAddRounds(-1)" ${curOpen && dayRounds().length > 1 ? '' : 'disabled'}>Remove this round</button>
      <p class="text-sm text-muted mt-8">Both work only before anyone in the round has started.</p>
    </div>

    <div class="card">
      <div class="card-title">Event</div>
      <div style="display:flex;gap:8px">
        <input class="input" id="m-name" value="${esc(App.event.name)}" aria-label="Event name" maxlength="60">
        <button class="btn btn-primary" style="width:auto" onclick="renameEvent()">Save</button>
      </div>
      <button class="btn btn-danger btn-icon mt-12" onclick="deleteEvent()">${ICONS.trash(16)}Delete this match day</button>
    </div>
  `;
}

async function dayAddPlayer() {
  const name = document.getElementById('m-new-player').value.trim();
  if (!name) return;
  await apiOp('add_player', { name });
  await regenerateRemaining();
  toast(`${name} joins from the next round`);
  rerender();
}

async function dayTogglePlayer(id, active) {
  await apiOp('update_player', { id, active });
  await regenerateRemaining();
  toast(active ? 'Back in from the next round' : 'Out from the next round. Still in this one? Swap them on the Rounds tab.', 4000);
  rerender();
}

async function dayAddRounds(d) {
  const rounds = App.event.settings.rounds + d;
  const from = firstFreeRound();
  if (rounds < from - 1 || rounds < 1) return;
  await apiOp('update_event', { settings: { ...App.event.settings, rounds } });
  await regenerateRemaining(rounds, from);
  rerender();
}

async function dayReshuffle() {
  await regenerateRemaining(App.event.settings.rounds, firstFreeRound());
  toast('Round reshuffled');
  rerender();
}

async function renameEvent() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) return;
  await apiOp('update_event', { name });
  Recent.add(App.event);
  toast('Saved');
  rerender();
}

async function deleteEvent() {
  const ok = await confirmSheet({
    title: `Delete "${App.event.name}"?`,
    body: `It disappears for everyone with the link, including all scores. This can't be undone.`,
    action: 'Delete for everyone', danger: true
  });
  if (!ok) return;
  await apiOp('delete_event', {});
  Recent.remove(App.slug); Keys.del(App.slug);
  App.slug = null; App.event = null;
  location.hash = '#/';
}
