// ── MATCH FORMAT ─────────────────────────────────────────────
function matchFormat(m) {
  if (App.event.kind === 'day') return App.event.settings.scoring || { type: 'total', n: 8 };
  return App.seasons.find(s => s.id === m.season_id)?.format || { type: 'firstto', n: 4 };
}
function defaultDeuce() { return App.event.settings.deuce || 'sudden'; }

// Replay a point log → games and the current game's points
function scoreFromLog(log) {
  let gA = 0, gB = 0, a = 0, b = 0;
  for (const w of log.w) {
    if (w === 'A') a++; else b++;
    const gw = gameWinner(a, b, log.deuce);
    if (gw) { if (gw === 'A') gA++; else gB++; a = 0; b = 0; }
  }
  return { gA, gB, a, b };
}

// ── SAVE QUEUE ───────────────────────────────────────────────
// Points are sent in order and each save carries the full match state.
// This phone's copy is the truth while scoring; a failed save is resent
// from it later, so the final point of a match is never stuck unsaved.
let _saveChain = Promise.resolve();
let _inFlight = 0, _retryTimer = null;
const _dirty = new Set();   // match ids whose latest save failed

function queueSave(data) {
  _inFlight++;
  _saveChain = _saveChain
    .then(() => apiOp('save_match', data, true))
    .then(() => _dirty.delete(data.id), () => {
      _dirty.add(data.id);
      _retryTimer ||= setTimeout(retrySaves, 5000);
    })
    .finally(() => _inFlight--);
  return _saveChain;
}

function retrySaves() {
  _retryTimer = null;
  _dirty.forEach(id => {
    const m = App.matches.find(x => x.id === id);
    if (m) queueSave({ id, points: m.points, score_a: m.score_a, score_b: m.score_b, status: m.status, live: m.live });
  });
}
window.addEventListener('online', retrySaves);

// True while this phone has scores the database doesn't have yet
function savesPending() { return _inFlight > 0 || _dirty.size > 0; }

// ── SCORER SCREEN ────────────────────────────────────────────
let _scorerId = null;

function renderScorer(matchId) {
  _scorerId = matchId;
  const m = App.matches.find(x => x.id === matchId);
  const el = document.getElementById('view');
  if (!m) { el.innerHTML = '<div class="empty">Match not found.</div>'; return; }

  const fmt  = matchFormat(m);
  const log  = m.points?.w != null ? m.points : { deuce: defaultDeuce(), w: '' };
  const sc   = scoreFromLog(log);
  const over = m.status === 'done';
  const started = log.w.length > 0;
  const na = teamNames(m.team_a), nb = teamNames(m.team_b);
  const lbl = pointLabels(sc.a, sc.b, log.deuce, shortName(na, 'Team A'), shortName(nb, 'Team B'));
  const where = m.round ? `Round ${m.round} · Court ${m.court}` : formatDate(m.date);
  const canEdit = App.isAdmin;

  // Every row above the POINT buttons keeps the same height whatever the match state,
  // so the buttons never move under a thumb mid-match
  const side = (t, name, games, pt) => `
    <div class="sc-side">
      <div class="sc-name">${esc(name)}</div>
      <div class="sc-games">${games}</div>
      <div class="sc-pt">${over ? '' : pt}</div>
    </div>`;

  let winner = '';
  if (over) {
    const w = m.score_a > m.score_b ? na : m.score_b > m.score_a ? nb : null;
    winner = `<div class="winner-banner"><div class="winner-banner-text">${w ? `${esc(w)} win ${m.score_a}–${m.score_b}` : `Draw ${m.score_a}–${m.score_b}`}</div></div>`;
  }

  el.innerHTML = `
    <div class="sc-top">
      <a class="back-link" href="#/e/${App.slug}">← Back</a>
      <div class="text-sm text-muted">${esc(where)} · ${esc(formatLabel(fmt))}</div>
    </div>

    <div class="scoreboard">
      ${side('a', na, over ? m.score_a : sc.gA, lbl.a)}
      <div class="sc-vs">${over ? 'FINAL' : 'GAMES'}</div>
      ${side('b', nb, over ? m.score_b : sc.gB, lbl.b)}
    </div>
    <div class="sc-status">${over ? '' : esc(lbl.status) || '&nbsp;'}</div>

    ${winner}

    ${canEdit && !over ? `
      <div class="sc-buttons">
        <button class="sc-btn sc-btn-a" onclick="scorerPoint('A')">Point<br><span>${esc(shortName(na, 'Team A'))}</span></button>
        <button class="sc-btn sc-btn-b" onclick="scorerPoint('B')">Point<br><span>${esc(shortName(nb, 'Team B'))}</span></button>
      </div>` : ''}

    ${canEdit ? `
      <button class="btn btn-outline mt-12" onclick="scorerUndo()" ${started ? '' : 'disabled'}>↩ Undo last point</button>`
      : `<p class="text-sm text-muted mt-8" style="text-align:center">Watching live. Only the organizer can score.</p>`}

    ${canEdit && !started && !over ? `
      <div class="card sc-setup">
        <div class="flex-between">
          <span class="text-sm">Deuce</span>
          <div class="seg">
            <button class="${log.deuce === 'sudden' ? 'active' : ''}" onclick="scorerSetup('deuce','sudden')">Sudden death</button>
            <button class="${log.deuce === 'full' ? 'active' : ''}" onclick="scorerSetup('deuce','full')">Advantage</button>
          </div>
        </div>
      </div>` : ''}

    ${started ? `
      <div class="sc-extra">
        <button class="btn btn-outline" onclick="openMatchStats(${m.id})">Match stats</button>
        ${canEdit && !over ? `<button class="btn btn-outline btn-quiet-danger" onclick="scorerFinishNow()">End match now</button>` : ''}
      </div>` : ''}
  `;

  // Screen readers hear the score after each point
  const live = document.getElementById('sr-live');
  if (live && started) live.textContent = over ? `Final: ${na} ${m.score_a}, ${nb} ${m.score_b}`
    : `Games: ${na} ${sc.gA}, ${nb} ${sc.gB}. Points ${lbl.a}–${lbl.b}. ${lbl.status || ''}`;
}

function _scorerMatch() { return App.matches.find(x => x.id === _scorerId); }

function scorerSetup(what, val) {
  const m = _scorerMatch();
  const log = { deuce: defaultDeuce(), w: '', ...(m.points || {}) };
  if (what === 'deuce') log.deuce = val;
  m.points = log;
  renderScorer(m.id);
  queueSave({ id: m.id, points: log });
}

function scorerPoint(side) {
  const m = _scorerMatch();
  if (!m || m.status === 'done') return;
  if (navigator.vibrate) navigator.vibrate(15);

  const log = { deuce: defaultDeuce(), w: '', ...(m.points || {}) };
  log.w += side;
  const sc = scoreFromLog(log);

  const over = isMatchOver(sc.gA, sc.gB, matchFormat(m));
  Object.assign(m, {
    points: log, score_a: sc.gA, score_b: sc.gB,
    status: over ? 'done' : 'live',
    live:   over ? null : {}
  });
  renderScorer(m.id);
  queueSave({ id: m.id, points: log, score_a: sc.gA, score_b: sc.gB, status: m.status, live: m.live });
  if (over) toast('Match saved');
}

function scorerUndo() {
  const m = _scorerMatch();
  if (!m?.points?.w) return;
  const log = { ...m.points };
  log.w = log.w.slice(0, -1);
  if (log.s) log.s = log.s.slice(0, -1); // older logs also stored the server
  const sc = scoreFromLog(log);
  Object.assign(m, { points: log, score_a: sc.gA, score_b: sc.gB, status: 'live', live: {} });
  renderScorer(m.id);
  queueSave({ id: m.id, points: log, score_a: sc.gA, score_b: sc.gB, status: 'live', live: m.live });
}

// Time's up: keep the games won so far as the final score
async function scorerFinishNow() {
  const m = _scorerMatch();
  const sc = scoreFromLog(m.points);
  const na = teamNames(m.team_a), nb = teamNames(m.team_b);
  const result = sc.gA > sc.gB ? `${esc(na)} win` : sc.gB > sc.gA ? `${esc(nb)} win` : 'It ends as a draw';
  const ok = await confirmSheet({
    title: `End at ${sc.gA}–${sc.gB}?`,
    body: `${result}. The games won so far become the final score. The current game is dropped.`,
    action: 'End match', danger: true
  });
  // Re-read: a realtime refresh may have replaced the match while the sheet was open
  const cur = _scorerMatch();
  if (!ok || !cur || cur.status === 'done') return;
  const fin = scoreFromLog(cur.points);
  Object.assign(cur, { score_a: fin.gA, score_b: fin.gB, status: 'done', live: null });
  renderScorer(cur.id);
  queueSave({ id: cur.id, points: cur.points, score_a: fin.gA, score_b: fin.gB, status: 'done', live: null });
}

// ── QUICK SCORE SHEET ────────────────────────────────────────
// Enter a final games score without point-by-point
let _quick = null;

function openQuickScore(matchId) {
  const m = App.matches.find(x => x.id === matchId);
  _quick = { id: matchId, team_a: m.team_a, team_b: m.team_b, a: m.score_a ?? 0, b: m.score_b ?? 0, fmt: matchFormat(m) };
  renderQuickScore();
}

// League: a match that doesn't exist yet — it's created on save
function openQuickScoreNew(teamA, teamB) {
  const draft = { season_id: App.seasonId };
  _quick = { id: null, team_a: teamA, team_b: teamB, a: 0, b: 0, fmt: matchFormat(draft) };
  renderQuickScore();
}

function renderQuickScore() {
  const m = _quick;
  const col = (t, name, v) => `
    <div class="score-col">
      <div class="score-col-label">${esc(name)}</div>
      <div class="score-controls">
        <button class="score-btn score-btn-down" onclick="quickAdj('${t}',-1)" aria-label="One game less for ${esc(name)}">−</button>
        <div class="score-num" aria-live="polite">${v}</div>
        <button class="score-btn score-btn-up" onclick="quickAdj('${t}',1)" aria-label="One game more for ${esc(name)}">+</button>
      </div>
    </div>`;
  openSheet(`
    <div class="modal-title">Enter score</div>
    <p class="text-sm text-muted mb-8">${esc(formatLabel(_quick.fmt))}</p>
    <div class="score-section-inner">
      ${col('a', teamNames(m.team_a), _quick.a)}
      <div class="score-vs">VS</div>
      ${col('b', teamNames(m.team_b), _quick.b)}
    </div>
    <button class="btn btn-green mt-8" onclick="saveQuickScore()">Save score</button>
    ${m.id ? `<button class="btn btn-outline mt-8" onclick="closeSheet();location.hash='#/e/${App.slug}/score/${m.id}'">Score point by point instead</button>` : ''}
  `);
}

function quickAdj(t, d) {
  const max = sideMax(_quick.fmt);
  _quick[t] = Math.max(0, Math.min(max, _quick[t] + d));
  // "total" format: keep the two sides adding up to n
  if (_quick.fmt.type === 'total') _quick[t === 'a' ? 'b' : 'a'] = _quick.fmt.n - _quick[t];
  renderQuickScore();
}

async function saveQuickScore() {
  const { id, a, b, fmt } = _quick;
  if (!isMatchOver(a, b, fmt) || (fmt.type !== 'total' && a === b)) {
    const ok = await confirmSheet({
      title: `Save ${a}–${b}?`,
      body: `That isn't a finished score for ${esc(formatLabel(fmt).toLowerCase())}. Save it as the final result anyway?`,
      action: 'Save anyway'
    });
    if (!ok) { renderQuickScore(); return; }
  }
  if (id) await apiOp('save_match', { id, score_a: a, score_b: b, status: 'done', live: null });
  else {
    await apiOp('save_match', { season_id: App.seasonId, date: today(), team_a: _quick.team_a, team_b: _quick.team_b,
                                score_a: a, score_b: b, status: 'done' });
    leagueResetPick();
    toast('Match saved');
  }
  closeSheet();
  rerender();
}

// ── LIVE CARD (for viewers) ──────────────────────────────────
function liveCardHtml(m) {
  const log = m.points?.w != null ? m.points : { deuce: defaultDeuce(), w: '' };
  const sc  = scoreFromLog(log);
  const na = teamNames(m.team_a), nb = teamNames(m.team_b);
  const lbl = pointLabels(sc.a, sc.b, log.deuce, shortName(na, 'Team A'), shortName(nb, 'Team B'));
  return `
    <a class="card live-card" href="#/e/${App.slug}/score/${m.id}">
      <div class="flex-between mb-8">
        <span class="live-dot">● LIVE${m.court ? ` · Court ${m.court}` : ''}</span>
        <span class="text-sm text-muted">${esc(lbl.status)}</span>
      </div>
      <div class="lc-row"><span class="lc-name">${esc(na)}</span><span class="lc-g">${sc.gA}</span><span class="lc-p">${lbl.a}</span></div>
      <div class="lc-row"><span class="lc-name">${esc(nb)}</span><span class="lc-g">${sc.gB}</span><span class="lc-p">${lbl.b}</span></div>
    </a>`;
}
