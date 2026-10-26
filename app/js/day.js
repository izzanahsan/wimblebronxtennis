// ── AMERICANO MATCH DAY ──────────────────────────────────────
const DAY_TABS = [
  { id: 'rounds',    label: 'Rounds',    render: () => renderRounds() },
  { id: 'standings', label: 'Standings', render: () => renderDayStandings() },
  { id: 'share',     label: 'Share',     render: () => renderShare() },
  { id: 'manage',    label: 'Manage',    render: () => renderDayManage(), admin: true }
];

// Schedule rounds fromRound … fromRound+count-1 for these players
function buildRounds(ids, fromRound, count) {
  const s = App.event?.settings || {};
  const sched = americanoSchedule(ids, s.courts || 1, count, (s.seed || 1) + fromRound);
  return sched.flatMap(r => r.matches.map(m => ({
    round: fromRound + r.round - 1, court: m.court, team_a: m.teamA, team_b: m.teamB
  })));
}

function dayRounds() {
  const byRound = {};
  App.matches.filter(m => m.round).forEach(m => { (byRound[m.round] ||= []).push(m); });
  return Object.keys(byRound).map(Number).sort((a, b) => a - b)
    .map(r => ({ round: r, matches: byRound[r].sort((a, b) => a.court - b.court) }));
}

// First round from which nothing has started (safe to regenerate)
function firstFreeRound() {
  const rounds = dayRounds();
  let free = (rounds.at(-1)?.round || 0) + 1;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].matches.every(m => m.status === 'scheduled')) free = rounds[i].round; else break;
  }
  return free;
}

async function regenerateRemaining(totalRounds = App.event.settings.rounds) {
  const from = firstFreeRound();
  const count = totalRounds - from + 1;
  const ids = App.players.filter(p => p.active).map(p => p.id);
  if (ids.length < 4) { toast('⚠️ Need at least 4 active players'); return; }
  await apiOp('replace_schedule', { from_round: from, matches: count > 0 ? buildRounds(ids, from, count) : [] });
}

// ── ROUNDS ───────────────────────────────────────────────────
function renderRounds() {
  const rounds = dayRounds();
  const el = document.getElementById('view');
  const done = rounds.filter(r => r.matches.every(m => m.status === 'done')).length;
  const current = rounds.find(r => r.matches.some(m => m.status !== 'done'));

  if (!rounds.length) { el.innerHTML = '<div class="empty">No rounds scheduled.</div>'; return; }

  el.innerHTML = `
    ${!current ? dayCompleteHtml() : ''}
    ${!App.isAdmin && current ? `<p class="intro-note">Americano: partners change every round and everyone plays everyone. Find your name to see your court.</p>` : ''}
    <div class="progress-row">
      <span>${done}/${rounds.length} rounds done</span>
      <div class="progress" role="progressbar" aria-label="Rounds done" aria-valuemin="0" aria-valuemax="${rounds.length}" aria-valuenow="${done}"><div style="width:${100 * done / rounds.length}%"></div></div>
    </div>
    ${rounds.map(r => roundCardHtml(r, r === current)).join('')}
  `;
  if (current) document.getElementById('round-' + current.round)?.scrollIntoView({ block: 'nearest' });
}

// The payoff when the last round finishes: the podium, and the way to the story
function dayCompleteHtml() {
  const rows = dayStandings().filter(r => r.played);
  if (!rows.length) return '';
  const ranks = tiedRanks(rows, (a, b) => a.points === b.points && a.wins === b.wins && a.diff === b.diff);
  const top = rows.map((r, i) => ({ r, rank: ranks[i] })).filter(x => x.rank <= 3);
  return `
  <div class="card day-complete">
    <div class="dc-head">${logoImg(40)}<div><div class="dc-title">That's a wrap</div><div class="text-sm text-muted">All rounds done</div></div></div>
    ${top.map(({ r, rank }) => `
      <div class="dc-row">
        <span class="lb-rank top${rank}">${rank}</span>
        <span class="dc-name">${esc(player(r.id)?.name)}</span>
        <span class="dc-pts">${r.points}<small> games</small></span>
      </div>`).join('')}
    <a class="btn btn-green mt-12" href="#/e/${App.slug}/share">Make the Instagram story</a>
  </div>`;
}

function roundCardHtml(r, isCurrent) {
  const playing = new Set(r.matches.flatMap(m => [...m.team_a, ...m.team_b]));
  const byes = App.players.filter(p => p.active && !playing.has(p.id));
  const allDone = r.matches.every(m => m.status === 'done');
  const started = r.matches.some(m => m.status !== 'scheduled');

  return `
  <section class="card round-card ${isCurrent ? 'current' : allDone ? 'done' : 'upcoming'}" id="round-${r.round}" aria-labelledby="rt-${r.round}">
    <div class="flex-between mb-8">
      <h2 class="card-title" id="rt-${r.round}" style="margin:0">Round ${r.round}</h2>
      <span class="round-state">${allDone ? 'Done' : isCurrent ? (started ? 'Now playing' : 'Up next') : ''}</span>
    </div>
    ${r.matches.map(m => matchRowHtml(m, isCurrent)).join('')}
    ${byes.length ? `<div class="text-sm text-muted mt-8">Sitting out: ${byes.map(p => esc(p.name)).join(', ')}</div>` : ''}
  </section>`;
}

// Actions show inline only on the current round; other open matches
// open the same choices from a sheet when tapped (organizer only)
function matchRowHtml(m, isCurrent) {
  const done = m.status === 'done', live = m.status === 'live';
  const aWin = done && m.score_a > m.score_b, bWin = done && m.score_b > m.score_a;
  const score = done || live
    ? `<span class="${aWin ? 'score-win' : ''}">${m.score_a ?? 0}</span><span class="text-muted">–</span><span class="${bWin ? 'score-win' : ''}">${m.score_b ?? 0}</span>`
    : '<span class="text-muted">vs</span>';
  const na = esc(teamNames(m.team_a)), nb = esc(teamNames(m.team_b));
  const tapOpen = App.isAdmin && !done && !live && !isCurrent;

  let action = '';
  if (App.isAdmin && !done && (isCurrent || live)) {
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
  <div class="match-row ${live ? 'is-live' : ''} ${tapOpen ? 'mr-tap' : ''}"
    ${tapOpen ? `role="button" tabindex="0" aria-label="Court ${m.court}: ${na} vs ${nb}. Score this match" onclick="openMatchActions(${m.id})"` : ''}>
    <div class="mr-court">C${m.court}</div>
    <div class="mr-team mr-a ${aWin ? 'win' : ''}">${na}</div>
    <div class="mr-score">${score}</div>
    <div class="mr-team mr-right ${bWin ? 'win' : ''}">${nb}</div>
    ${action}
  </div>`;
}

function openMatchActions(id) {
  const m = App.matches.find(x => x.id === id);
  if (!m) return;
  openSheet(`
    <div class="modal-title">Round ${m.round} · Court ${m.court}</div>
    <p class="confirm-body">${esc(teamNames(m.team_a))} <span class="text-muted">vs</span> ${esc(teamNames(m.team_b))}</p>
    <a class="btn btn-green" href="#/e/${App.slug}/score/${m.id}">Score live, point by point</a>
    <button class="btn btn-outline mt-8" onclick="openQuickScore(${m.id})">Enter the final score</button>
  `);
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
  const free = firstFreeRound();
  document.getElementById('view').innerHTML = `
    <div class="card">
      <div class="card-title">Players</div>
      <p class="text-sm text-muted mb-8">Adding or removing someone reshuffles rounds ${free}+ (rounds already started stay as they are).</p>
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
      <p class="text-sm text-muted mb-8">${s.rounds} rounds · ${s.courts} court${s.courts > 1 ? 's' : ''} · ${esc(formatLabel(s.scoring))}</p>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" onclick="dayAddRounds(1)">+1 round</button>
        <button class="btn btn-outline" onclick="dayAddRounds(2)">+2 rounds</button>
        <button class="btn btn-outline" onclick="dayAddRounds(-1)" ${s.rounds < free ? 'disabled' : ''}>−1 round</button>
      </div>
      <button class="btn btn-outline btn-icon mt-8" onclick="dayReshuffle()">${ICONS.shuffle(16)}Reshuffle remaining rounds</button>
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
  toast(`${name} added to the remaining rounds`);
  rerender();
}

async function dayTogglePlayer(id, active) {
  await apiOp('update_player', { id, active });
  await regenerateRemaining();
  toast(active ? 'Back in the rotation' : 'Removed from the remaining rounds');
  rerender();
}

async function dayAddRounds(d) {
  const rounds = App.event.settings.rounds + d;
  if (rounds < firstFreeRound() - 1 || rounds < 1) return;
  await apiOp('update_event', { settings: { ...App.event.settings, rounds } });
  await regenerateRemaining(rounds);
  rerender();
}

async function dayReshuffle() {
  await apiOp('update_event', { settings: { ...App.event.settings, seed: Math.floor(Math.random() * 1e9) } });
  await regenerateRemaining();
  toast('Remaining rounds reshuffled');
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
