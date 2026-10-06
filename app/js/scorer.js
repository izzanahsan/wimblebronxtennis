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
// Points are sent in order; each save carries the full log, so a
// failed save is repaired by the next one.
let _saveChain = Promise.resolve();
function queueSave(data) {
  _saveChain = _saveChain.then(() => apiOp('save_match', data)).catch(() => {});
  return _saveChain;
}

// ── SCORER SCREEN ────────────────────────────────────────────
let _scorerId = null;

function renderScorer(matchId) {
  _scorerId = matchId;
  const m = App.matches.find(x => x.id === matchId);
  const el = document.getElementById('view');
  if (!m) { el.innerHTML = '<div class="empty">Match not found.</div>'; return; }

  const fmt  = matchFormat(m);
  const log  = m.points?.w != null ? m.points : { deuce: defaultDeuce(), w: '', s: '' };
  const sc   = scoreFromLog(log);
  const serve = (m.live?.serve || 'a');
  const over = m.status === 'done';
  const started = log.w.length > 0;
  const na = teamNames(m.team_a), nb = teamNames(m.team_b);
  const lbl = pointLabels(sc.a, sc.b, log.deuce, over ? null : serve, shortName(na, 'Team A'), shortName(nb, 'Team B'));
  const where = m.round ? `Round ${m.round} · Court ${m.court}` : formatDate(m.date);
  const canEdit = App.isAdmin;

  const side = (t, name, games, pt) => `
    <div class="sc-side ${!over && serve === t ? 'serving' : ''}">
      <div class="sc-name">${!over && serve === t ? '<span class="ball">🎾</span>' : ''}${esc(name)}</div>
      <div class="sc-games">${games}</div>
      <div class="sc-pt">${over ? '' : pt}</div>
    </div>`;

  let winner = '';
  if (over) {
    const w = m.score_a > m.score_b ? na : m.score_b > m.score_a ? nb : null;
    winner = `<div class="winner-banner"><div class="winner-banner-text">${w ? `🏆 ${esc(w)} win ${m.score_a}–${m.score_b}` : `Draw ${m.score_a}–${m.score_b}`}</div></div>`;
  }

  el.innerHTML = `
    <div class="sc-top">
      <a class="back-link" href="#/e/${App.slug}">← Back</a>
      <div class="text-sm text-muted">${esc(where)} · ${esc(formatLabel(fmt))}</div>
    </div>

    ${canEdit && !started && !over ? `
      <div class="card">
        <div class="flex-between mb-8">
          <span class="text-sm">Deuce</span>
          <div class="seg">
            <button class="${log.deuce === 'sudden' ? 'active' : ''}" onclick="scorerSetup('deuce','sudden')">Sudden death</button>
            <button class="${log.deuce === 'full' ? 'active' : ''}" onclick="scorerSetup('deuce','full')">Advantage</button>
          </div>
        </div>
        <div class="flex-between">
          <span class="text-sm">First serve</span>
          <div class="seg">
            <button class="${serve === 'a' ? 'active' : ''}" onclick="scorerSetup('serve','a')">${esc(shortName(na, 'Team A'))}</button>
            <button class="${serve === 'b' ? 'active' : ''}" onclick="scorerSetup('serve','b')">${esc(shortName(nb, 'Team B'))}</button>
          </div>
        </div>
      </div>` : ''}

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
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-outline" style="flex:1" onclick="scorerUndo()" ${started ? '' : 'disabled'}>↩ Undo point</button>
        ${!over && started ? `<button class="btn btn-outline" style="flex:1" onclick="scorerFinishNow()">⏱ End now</button>` : ''}
      </div>` : `<p class="text-sm text-muted mt-8" style="text-align:center">Watching live — only the organizer can score.</p>`}

    ${started ? `<button class="btn btn-outline mt-8" onclick="openMatchStats(${m.id})">📊 Match stats</button>` : ''}
  `;
}

function _scorerMatch() { return App.matches.find(x => x.id === _scorerId); }

function scorerSetup(what, val) {
  const m = _scorerMatch();
  const log = { deuce: defaultDeuce(), w: '', s: '', ...(m.points || {}) };
  const live = { serve: 'a', ...(m.live || {}) };
  if (what === 'deuce') log.deuce = val; else live.serve = val;
  m.points = log; m.live = live;
  renderScorer(m.id);
  queueSave({ id: m.id, points: log, live });
}

function scorerPoint(side) {
  const m = _scorerMatch();
  if (!m || m.status === 'done') return;
  if (navigator.vibrate) navigator.vibrate(15);

  const log = { deuce: defaultDeuce(), w: '', s: '', ...(m.points || {}) };
  let serve = m.live?.serve || 'a';
  const before = scoreFromLog(log);

  log.w += side;
  log.s += serve.toUpperCase();
  const sc = scoreFromLog(log);
  if (sc.gA + sc.gB > before.gA + before.gB) serve = serve === 'a' ? 'b' : 'a'; // game over → change server

  const over = isMatchOver(sc.gA, sc.gB, matchFormat(m));
  Object.assign(m, {
    points: log, score_a: sc.gA, score_b: sc.gB,
    status: over ? 'done' : 'live',
    live:   over ? null : { serve }
  });
  renderScorer(m.id);
  queueSave({ id: m.id, points: log, score_a: sc.gA, score_b: sc.gB, status: m.status, live: m.live });
  if (over) toast('🏆 Match saved');
}

function scorerUndo() {
  const m = _scorerMatch();
  if (!m?.points?.w) return;
  const log = { ...m.points };
  const serve = (log.s.at(-1) || 'A').toLowerCase(); // server of the removed point
  log.w = log.w.slice(0, -1);
  log.s = log.s.slice(0, -1);
  const sc = scoreFromLog(log);
  Object.assign(m, { points: log, score_a: sc.gA, score_b: sc.gB, status: 'live', live: { serve } });
  renderScorer(m.id);
  queueSave({ id: m.id, points: log, score_a: sc.gA, score_b: sc.gB, status: 'live', live: m.live });
}

// Time's up: keep the games won so far as the final score
function scorerFinishNow() {
  const m = _scorerMatch();
  if (!confirm('End the match now with the current games score?')) return;
  const sc = scoreFromLog(m.points);
  Object.assign(m, { score_a: sc.gA, score_b: sc.gB, status: 'done', live: null });
  renderScorer(m.id);
  queueSave({ id: m.id, score_a: sc.gA, score_b: sc.gB, status: 'done', live: null });
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
        <button class="score-btn score-btn-down" onclick="quickAdj('${t}',-1)">−</button>
        <div class="score-num">${v}</div>
        <button class="score-btn score-btn-up" onclick="quickAdj('${t}',1)">+</button>
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
    <button class="btn btn-green mt-8" onclick="saveQuickScore()">✅ Save score</button>
    <div style="height:8px"></div>
    ${m.id ? `<button class="btn btn-outline" onclick="closeSheet();location.hash='#/e/${App.slug}/score/${m.id}'">🎾 Score live instead</button>` : ''}
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
    if (!confirm(`That isn't a finished ${formatLabel(fmt).toLowerCase()} score. Save anyway?`)) return;
  }
  if (id) await apiOp('save_match', { id, score_a: a, score_b: b, status: 'done', live: null });
  else {
    await apiOp('save_match', { season_id: App.seasonId, date: today(), team_a: _quick.team_a, team_b: _quick.team_b,
                                score_a: a, score_b: b, status: 'done' });
    leagueResetPick();
    toast('✅ Match saved');
  }
  closeSheet();
  rerender();
}

// ── LIVE CARD (for viewers) ──────────────────────────────────
function liveCardHtml(m) {
  const log = m.points?.w != null ? m.points : { deuce: defaultDeuce(), w: '' };
  const sc  = scoreFromLog(log);
  const na = teamNames(m.team_a), nb = teamNames(m.team_b);
  const lbl = pointLabels(sc.a, sc.b, log.deuce, m.live?.serve, shortName(na, 'Team A'), shortName(nb, 'Team B'));
  const srv = m.live?.serve;
  return `
    <a class="card live-card" href="#/e/${App.slug}/score/${m.id}">
      <div class="flex-between mb-8">
        <span class="live-dot">● LIVE${m.court ? ` · Court ${m.court}` : ''}</span>
        <span class="text-sm text-muted">${esc(lbl.status)}</span>
      </div>
      <div class="lc-row"><span class="lc-name">${srv === 'a' ? '🎾 ' : ''}${esc(na)}</span><span class="lc-g">${sc.gA}</span><span class="lc-p">${lbl.a}</span></div>
      <div class="lc-row"><span class="lc-name">${srv === 'b' ? '🎾 ' : ''}${esc(nb)}</span><span class="lc-g">${sc.gB}</span><span class="lc-p">${lbl.b}</span></div>
    </a>`;
}
