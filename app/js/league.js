// ── LEAGUE ───────────────────────────────────────────────────
const LEAGUE_TABS = [
  { id: 'table',   label: 'Standings', render: () => renderLeagueTable() },
  { id: 'play',    label: 'Play',      render: () => renderLeaguePlay() },
  { id: 'history', label: 'History',   render: () => renderLeagueHistory() },
  { id: 'share',   label: '📸 Share',  render: () => renderShare() },
  { id: 'manage',  label: 'Manage',    render: () => renderLeagueManage(), admin: true }
];

function season()           { return App.seasons.find(s => s.id === App.seasonId); }
function seasonDone(sid = App.seasonId) {
  return App.matches.filter(m => m.season_id === sid && m.status === 'done');
}

// Win = 3 pts, loss = 1 pt (for turning up). Ties broken by wins, game diff, games won.
function leagueTable(matches) {
  const stats = {};
  const row = id => (stats[id] ||= { id, pts: 0, wins: 0, played: 0, gamesWon: 0, gamesLost: 0, results: [] });
  App.players.forEach(p => row(p.id));

  matches.forEach(m => {
    const aWon = m.score_a > m.score_b;
    [[m.team_a, aWon, m.score_a, m.score_b], [m.team_b, !aWon, m.score_b, m.score_a]].forEach(([team, won, gf, ga]) => {
      team.forEach(id => {
        const r = row(id);
        r.played++; r.pts += won ? 3 : 1; if (won) r.wins++;
        r.gamesWon += gf; r.gamesLost += ga; r.results.push(won);
      });
    });
  });

  return Object.values(stats)
    .filter(r => player(r.id) && (r.played || player(r.id).active))
    .map(r => ({ ...r, diff: r.gamesWon - r.gamesLost, last5: r.results.slice(-5) }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.diff - a.diff || b.gamesWon - a.gamesWon);
}

// ── STANDINGS ────────────────────────────────────────────────
function renderLeagueTable() {
  const s = season();
  const rows = leagueTable(seasonDone());
  const live = App.matches.filter(m => m.status === 'live');

  document.getElementById('view').innerHTML = `
    ${live.map(liveCardHtml).join('')}
    <div class="flex-between">
      <p class="section-title" style="margin:0">Standings</p>
      <span class="text-sm text-muted">${esc(formatLabel(s?.format))}</span>
    </div>
    ${s?.winner ? `<div class="text-sm" style="margin:6px 0 10px">🏆 Season winner: <strong>${esc(s.winner)}</strong></div>` : '<div style="height:10px"></div>'}
    <div class="card">
    ${rows.length ? rows.map((r, i) => {
      const p = player(r.id);
      const dots = Array.from({ length: 5 }, (_, j) =>
        `<div class="win-dot ${j < r.last5.length ? (r.last5[j] ? 'w' : 'l') : ''}"></div>`).join('');
      const diff = r.diff > 0 ? `+${r.diff}` : r.diff === 0 ? '±0' : r.diff;
      const record = `${r.wins}W – ${r.played - r.wins}L · ${r.pts} pts · games ${diff}`;
      return `
      <div class="lb-row" onclick="openPlayerStats(${r.id}, seasonDone(), '${record}', season()?.name)">
        <div class="lb-rank ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}">${i + 1}</div>
        ${playerAvatar(p, 34)}
        <div class="lb-info">
          <div class="lb-name">${esc(p.name)}</div>
          <div class="wins-bar">${dots}</div>
          <div class="lb-sub">${r.wins}W · ${r.played} played · <span class="${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}">${diff}</span></div>
        </div>
        <div class="lb-pts">${r.pts}</div>
      </div>`;
    }).join('') : '<div class="empty">No players yet.</div>'}
    </div>
    <p class="text-sm text-muted">Win = 3 pts · Loss = 1 pt. Tap a player for stats.</p>
  `;
}

function openSeasonSwitcher() {
  openSheet(`
    <div class="modal-title">Season</div>
    ${[...App.seasons].reverse().map(s => `
      <div class="season-switch-row ${s.id === App.seasonId ? 'active-season' : ''}" onclick="switchSeason(${s.id})">
        <div class="season-switch-name">${esc(s.name)}${s.id === App.seasonId ? ' ✓' : ''}</div>
        <div class="season-switch-meta">${formatDate(s.start_date)} – ${formatDate(s.end_date)} · ${seasonDone(s.id).length} matches${s.winner ? ` · 🏆 ${esc(s.winner)}` : ''}</div>
      </div>`).join('')}
  `);
}

function switchSeason(id) {
  App.seasonId = id;
  closeSheet();
  rerender();
}

// ── PLAY ─────────────────────────────────────────────────────
let _pick = { a: [], b: [], hint: '' };
function leagueResetPick() { _pick = { a: [], b: [], hint: '' }; }

function renderLeaguePlay() {
  const live = App.matches.filter(m => m.status === 'live');
  const el = document.getElementById('view');

  if (!App.isAdmin) {
    el.innerHTML = `${live.map(liveCardHtml).join('') || '<div class="empty">No match being played right now.</div>'}
      <p class="text-sm text-muted" style="text-align:center">Only organizers can log matches.</p>`;
    return;
  }
  if (!season()) { el.innerHTML = '<div class="empty">Create a season in Manage first.</div>'; return; }

  const ps = App.players;
  const busy = new Set(live.flatMap(m => [...m.team_a, ...m.team_b]));
  const chips = t => ps.map(p => {
    const inA = _pick.a.includes(p.id), inB = _pick.b.includes(p.id);
    const cls = inA ? 'sel-a' : inB ? 'sel-b' : '';
    const off = (t === 'a' && inB) || (t === 'b' && inA) ? 'disabled' : (!p.active || busy.has(p.id)) ? 'unavail' : '';
    return `<div class="p-tag ${cls} ${off}" onclick="leaguePick(${p.id},'${t}')">${esc(p.name)}</div>`;
  }).join('');
  const ready = _pick.a.length >= 1 && _pick.a.length === _pick.b.length;

  el.innerHTML = `
    ${live.map(liveCardHtml).join('')}
    <div class="card">
      <div class="card-title">🎲 Pick teams</div>
      <button class="random-btn" onclick="leagueRandomize()">⚡ Randomize doubles</button>
      <div class="team-box"><div class="team-label team-a-label">TEAM A</div><div class="player-select">${chips('a')}</div></div>
      <div class="team-box"><div class="team-label team-b-label">TEAM B</div><div class="player-select">${chips('b')}</div></div>
      <p class="text-sm text-muted mt-8">${esc(_pick.hint || `Team A: ${_pick.a.length}/2 · Team B: ${_pick.b.length}/2 — 1 each for singles`)}</p>
    </div>
    ${ready ? `
    <div class="card">
      <div class="card-title">${esc(teamNames(_pick.a))} vs ${esc(teamNames(_pick.b))}</div>
      <p class="text-sm text-muted mb-8">${esc(formatLabel(season().format))}</p>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" onclick="openQuickScoreNew(_pick.a, _pick.b)">Enter result</button>
        <button class="btn btn-green" onclick="leagueStartLive()">🎾 Score live</button>
      </div>
    </div>` : ''}
    <p class="text-sm text-muted">Greyed-out players are marked away or are on court now.</p>
  `;
}

function leaguePick(id, t) {
  const mine = _pick[t], other = _pick[t === 'a' ? 'b' : 'a'];
  if (other.includes(id)) return;
  if (mine.includes(id)) _pick[t] = mine.filter(x => x !== id);
  else if (mine.length < 2) mine.push(id);
  _pick.hint = '';
  rerender();
}

async function leagueStartLive() {
  const m = await apiOp('save_match', {
    season_id: App.seasonId, date: today(), team_a: _pick.a, team_b: _pick.b,
    score_a: 0, score_b: 0, status: 'live',
    points: { deuce: defaultDeuce(), w: '', s: '' }, live: { serve: 'a' }
  });
  leagueResetPick();
  location.hash = `#/e/${App.slug}/score/${m.id}`;
}

// Fewest matches today → fewest this season → random; then the split
// that repeats the fewest past partnerships
function leagueRandomize() {
  const busy = new Set(App.matches.filter(m => m.status === 'live').flatMap(m => [...m.team_a, ...m.team_b]));
  const avail = App.players.filter(p => p.active && !busy.has(p.id));
  if (avail.length < 4) { _pick.hint = `⚠️ Need 4 available players (${avail.length} available).`; rerender(); return; }

  const done = seasonDone();
  const count = (id, list) => list.filter(m => m.team_a.includes(id) || m.team_b.includes(id)).length;
  const todays = done.filter(m => m.date === today());
  const pool = [...avail].sort((a, b) =>
    count(a.id, todays) - count(b.id, todays) || count(a.id, done) - count(b.id, done) || Math.random() - 0.5
  ).slice(0, 4).map(p => p.id);

  const pairs = new Set();
  done.forEach(m => [m.team_a, m.team_b].forEach(t => t.length === 2 && pairs.add([...t].sort().join('-'))));
  const rep = c => (pairs.has([c[0], c[1]].sort().join('-')) ? 1 : 0) + (pairs.has([c[2], c[3]].sort().join('-')) ? 1 : 0);
  const [i0, i1, i2, i3] = pool;
  const best = [[i0, i1, i2, i3], [i0, i2, i1, i3], [i0, i3, i1, i2]].sort((x, y) => rep(x) - rep(y))[0];

  _pick = { a: [best[0], best[1]], b: [best[2], best[3]], hint: '' };
  const r = rep(best);
  _pick.hint = count(pool[0], todays) > 0 ? '⚠️ Everyone has played today — picked who played least.'
             : r === 2 ? '⚠️ Both pairs have played together before.'
             : r === 1 ? '⚠️ One pair has played together before — best available.' : '✅ Fresh pairs!';
  rerender();
}

// ── HISTORY ──────────────────────────────────────────────────
function renderLeagueHistory() {
  const list = App.matches.filter(m => m.season_id === App.seasonId && m.status === 'done')
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const byDate = {};
  list.forEach(m => (byDate[m.date] ||= []).push(m));

  document.getElementById('view').innerHTML = list.length ? Object.entries(byDate).map(([d, ms]) => `
    <div class="card">
      <div class="flex-between mb-8">
        <div class="card-title" style="margin:0">${formatDate(d)}${d === today() ? ' · Today' : ''}</div>
        <a class="btn-mini" href="#/e/${App.slug}/share" onclick="_shareDate='${d}'">📸 Share day</a>
      </div>
      ${ms.map(m => {
        const aWin = m.score_a > m.score_b;
        return `
        <div class="match-row">
          <div class="mr-team mr-a ${aWin ? 'win' : ''}">${esc(teamNames(m.team_a))}</div>
          <div class="mr-score"><span class="${aWin ? 'score-win' : ''}">${m.score_a}</span><span class="text-muted">–</span><span class="${!aWin ? 'score-win' : ''}">${m.score_b}</span></div>
          <div class="mr-team mr-right ${!aWin ? 'win' : ''}">${esc(teamNames(m.team_b))}</div>
          <div class="mr-actions">
            ${m.points?.w ? `<button class="btn-mini" onclick="openMatchStats(${m.id})">📊</button>` : ''}
            ${App.isAdmin ? `<button class="btn-mini" onclick="leagueDeleteMatch(${m.id})">🗑</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`).join('') : '<div class="empty">No matches yet this season.</div>';
}

async function leagueDeleteMatch(id) {
  const m = App.matches.find(x => x.id === id);
  if (!confirm(`Delete ${teamNames(m.team_a)} ${m.score_a}–${m.score_b} ${teamNames(m.team_b)}?`)) return;
  await apiOp('delete_match', { id });
  rerender();
}

// ── MANAGE (organizer) ───────────────────────────────────────
function renderLeagueManage() {
  document.getElementById('view').innerHTML = `
    <div class="card">
      <div class="card-title">Players</div>
      <p class="text-sm text-muted mb-8">Toggle off anyone who's away — the randomizer skips them. Tap a photo to change it.</p>
      ${App.players.map(p => `
        <div class="avail-row">
          <label style="cursor:pointer;position:relative">
            ${playerAvatar(p, 34)}
            <input type="file" accept="image/*" style="display:none" onchange="uploadPlayerPhoto(${p.id}, this.files[0])">
          </label>
          <div class="avail-name" style="opacity:${p.active ? 1 : .45}">${esc(p.name)}</div>
          <button class="btn-mini" onclick="leagueDeletePlayer(${p.id})" aria-label="Delete">🗑</button>
          <label class="toggle">
            <input type="checkbox" ${p.active ? 'checked' : ''} onchange="apiOp('update_player',{id:${p.id},active:this.checked}).then(rerender)">
            <span class="toggle-slider"></span>
          </label>
        </div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:10px">
        <input class="input" id="m-new-player" placeholder="New player" maxlength="24" onkeydown="if(event.key==='Enter')leagueAddPlayer()">
        <button class="btn btn-primary" style="width:auto" onclick="leagueAddPlayer()">Add</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Seasons</div>
      ${[...App.seasons].reverse().map(s => `
        <div class="season-row">
          <div class="season-info-block">
            <div class="season-name">${esc(s.name)} ${s.id === App.seasonId ? '<span class="pos" style="font-size:11px">● viewing</span>' : ''}</div>
            <div class="season-dates">${formatDate(s.start_date)} – ${formatDate(s.end_date)} · ${esc(formatLabel(s.format))}</div>
            <div class="text-sm text-muted">${seasonDone(s.id).length} matches${s.winner ? ` · 🏆 ${esc(s.winner)}` : ''}</div>
          </div>
          ${App.seasons.length > 1 ? `<button class="btn-mini" onclick="leagueDeleteSeason(${s.id})">🗑</button>` : ''}
        </div>`).join('')}
      <button class="btn btn-outline mt-8" onclick="openNewSeason()">+ New season</button>
    </div>

    <div class="card">
      <div class="card-title">League</div>
      <div style="display:flex;gap:8px">
        <input class="input" id="m-name" value="${esc(App.event.name)}" maxlength="60">
        <button class="btn btn-primary" style="width:auto" onclick="renameEvent()">Save</button>
      </div>
      <div class="flex-between mt-8">
        <span class="text-sm">Live scoring deuce</span>
        <div class="seg">
          <button class="${defaultDeuce() === 'sudden' ? 'active' : ''}" onclick="leagueSetDeuce('sudden')">Sudden death</button>
          <button class="${defaultDeuce() === 'full' ? 'active' : ''}" onclick="leagueSetDeuce('full')">Advantage</button>
        </div>
      </div>
      <button class="btn btn-danger mt-8" onclick="deleteEvent()">🗑 Delete league</button>
    </div>
  `;
}

async function leagueAddPlayer() {
  const name = document.getElementById('m-new-player').value.trim();
  if (!name) return;
  await apiOp('add_player', { name });
  rerender();
}

async function leagueDeletePlayer(id) {
  if (!confirm(`Delete ${player(id).name}? Their past matches stay but show "?".`)) return;
  await apiOp('delete_player', { id });
  rerender();
}

async function leagueSetDeuce(d) {
  await apiOp('update_event', { settings: { ...App.event.settings, deuce: d } });
  rerender();
}

async function leagueDeleteSeason(id) {
  const s = App.seasons.find(x => x.id === id);
  if (!confirm(`Delete "${s.name}" and its ${seasonDone(id).length} matches?`)) return;
  await apiOp('delete_season', { id });
  if (App.seasonId === id) App.seasonId = App.seasons.at(-1)?.id ?? null;
  rerender();
}

let _nsFmt = { type: 'firstto', n: 4 };
function openNewSeason() {
  const end = new Date(); end.setMonth(end.getMonth() + 3);
  openSheet(`
    <div class="modal-title">New season</div>
    <p class="text-sm text-muted mb-8">The current leader of ${esc(season()?.name || 'this season')} is recorded as its winner.</p>
    <div class="input-group"><label class="input-label">Name</label>
      <input class="input" id="ns-name" value="Season ${App.seasons.length + 1}" maxlength="40"></div>
    <div style="display:flex;gap:10px">
      <div class="input-group" style="flex:1"><label class="input-label">Start</label><input class="input" type="date" id="ns-start" value="${today()}"></div>
      <div class="input-group" style="flex:1"><label class="input-label">End</label><input class="input" type="date" id="ns-end" value="${end.toLocaleDateString('en-CA')}"></div>
    </div>
    <div class="format-selector">
      <button class="fmt-btn ${_nsFmt.type === 'firstto' ? 'active' : ''}" onclick="_nsFmt={type:'firstto',n:4};openNewSeason()">First to N</button>
      <button class="fmt-btn ${_nsFmt.type === 'bo' ? 'active' : ''}" onclick="_nsFmt={type:'bo',n:7};openNewSeason()">Best of N</button>
    </div>
    <div class="n-picker mb-8">${(_nsFmt.type === 'bo' ? BO_OPTS : FIRSTTO_OPTS).map(n =>
      `<div class="n-opt ${n === _nsFmt.n ? 'active' : ''}" onclick="_nsFmt.n=${n};openNewSeason()">${n}</div>`).join('')}</div>
    <button class="btn btn-green" onclick="createSeason()">🚀 Start season</button>
  `);
}

async function createSeason() {
  const name = document.getElementById('ns-name').value.trim() || `Season ${App.seasons.length + 1}`;
  const cur = season();
  if (cur && !cur.winner) {
    const leader = leagueTable(seasonDone(cur.id)).find(r => r.played);
    if (leader) await apiOp('update_season', { id: cur.id, winner: player(leader.id).name });
  }
  const s = await apiOp('add_season', {
    name, start_date: document.getElementById('ns-start').value, end_date: document.getElementById('ns-end').value, format: _nsFmt
  });
  App.seasonId = s.id;
  closeSheet();
  toast(`✅ ${name} started`);
  location.hash = `#/e/${App.slug}/table`;
}

// ── PHOTO UPLOAD ─────────────────────────────────────────────
async function uploadPlayerPhoto(playerId, file) {
  if (!file) return;
  try {
    const img = await loadImageFromFile(file);
    const canvas = document.createElement('canvas');
    const scale = Math.min(400 / img.naturalWidth, 400 / img.naturalHeight, 1);
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.75));

    const path = `${App.slug}/p${playerId}-${Date.now()}.jpg`;
    const { error } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
    await apiOp('update_player', { id: playerId, photo_url: publicUrl });
    toast('✅ Photo updated');
    rerender();
  } catch (e) {
    console.error(e);
    toast('❌ ' + (e.message || 'Photo upload failed'));
  }
}
