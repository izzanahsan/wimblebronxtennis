// ── ROUTER ───────────────────────────────────────────────────
//   #/                      home
//   #/new/day | #/new/league create forms
//   #/e/<slug>[/<tab>]      event (append ?k=<key> for the organizer link)
//   #/e/<slug>/score/<id>   live scorer
function parseRoute() {
  const [path, query] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  return { parts, key: params.get('k') };
}

let _route = { parts: [] };

async function route() {
  const { parts, key } = parseRoute();
  _route = { parts };
  closeSheet();
  window.scrollTo(0, 0);

  if (parts[0] === 'e' && parts[1]) {
    const slug = parts[1];
    // Old organizer links still work: drop the key from the address bar
    if (key) history.replaceState(null, '', `#/${parts.join('/')}`);
    if (App.slug !== slug) {
      setHeader(null);
      document.getElementById('view').innerHTML = '<div class="loading-inline"><div class="loading-spinner"></div></div>';
      let ok = false;
      try { ok = await loadEvent(slug); } catch (e) { console.error(e); }
      if (!ok) {
        App.slug = null;
        document.getElementById('view').innerHTML = `<div class="empty">Event not found. Check the code or link, or ask the organizer to send it again.<br><a href="#/">Go home</a></div>`;
        return;
      }
      subscribe(slug, rerender);
    }
    rerender();
    return;
  }

  unsubscribe();
  App.slug = null;
  setHeader(null);
  if (parts[0] === 'new') renderCreate(parts[1] === 'league' ? 'league' : 'day');
  else renderHome();
}

// Re-render the current screen from App (no refetch)
function rerender() {
  const { parts } = _route;
  if (!App.event || parts[0] !== 'e') return;
  App.isAdmin = true;

  if (parts[2] === 'score') {
    setHeader(App.event, null);
    renderScorer(Number(parts[3]));
    return;
  }
  const tabs = App.event.kind === 'day' ? DAY_TABS : LEAGUE_TABS;
  const tab  = tabs.find(t => t.id === parts[2] && (!t.admin || App.isAdmin)) || tabs[0];
  setHeader(App.event, tab.id);
  tab.render();
}

// ── HEADER + TABS ────────────────────────────────────────────
function setHeader(ev, activeTab) {
  const h = document.getElementById('event-header');
  const nav = document.getElementById('event-nav');
  if (!ev) { h.innerHTML = ''; nav.innerHTML = ''; nav.style.display = 'none'; return; }

  const tabs = ev.kind === 'day' ? DAY_TABS : LEAGUE_TABS;
  const season = App.seasons.find(s => s.id === App.seasonId);
  h.innerHTML = `
    <div class="ev-head">
      <a href="#/" class="ev-home" aria-label="Wimblebronx home">${logoImg(42)}</a>
      <div class="ev-title-wrap">
        <h1 class="ev-title">${esc(ev.name)}</h1>
        <div class="ev-sub">
          ${ev.kind === 'day' ? 'Americano' : 'League'}
          ${ev.kind === 'league' && season ? ` · <button type="button" class="season-badge" onclick="openSeasonSwitcher()" aria-label="Season: ${esc(season.name)}. Change season">${esc(season.name)} ▾</button>` : ''}
        </div>
      </div>
      <button class="icon-btn" onclick="openInvite()" aria-label="Share links">${ICONS.share(18)}</button>
    </div>`;

  nav.style.display = activeTab ? 'flex' : 'none';
  nav.innerHTML = tabs.filter(t => !t.admin || App.isAdmin).map(t =>
    `<a class="nav-btn ${t.id === activeTab ? 'active' : ''}" href="#/e/${ev.slug}/${t.id}">${t.label}</a>`).join('');
}

function openInvite() {
  const s = App.slug;
  openSheet(`
    <div class="modal-title">Share</div>
    <div class="link-box">
      <div class="input-label">Anyone with this link can follow and keep score</div>
      <div class="link-row"><code>${esc(viewLink(s))}</code><button class="btn-mini" onclick="copyText('${viewLink(s)}','View link')">Copy</button></div>
    </div>
    <div class="text-sm text-muted">Event code: <strong>${esc(s)}</strong></div>
  `);
}

// ── HOME ─────────────────────────────────────────────────────
function renderHome() {
  const recent = Recent.list();
  document.getElementById('view').innerHTML = `
    <div class="hero">
      <img src="icon-512.png" alt="" class="hero-logo" width="132" height="132">
      <h1 class="logo">Wimblebronx</h1>
      <p class="text-muted">Tennis Tracker for Bronxpeople!</p>
    </div>

    <a class="big-choice" href="#/new/day">
      <div class="bc-icon">${ICONS.day(24)}</div>
      <div class="bc-body"><div class="bc-title">Start a match day</div><div class="bc-sub">Americano: partners rotate, everyone plays everyone. Live scores and IG results.</div></div>
      <span class="bc-chev">${ICONS.chev(20)}</span>
    </a>
    <a class="big-choice" href="#/new/league">
      <div class="bc-icon">${ICONS.league(24)}</div>
      <div class="bc-body"><div class="bc-title">Create a league</div><div class="bc-sub">Ongoing standings across seasons. Randomize doubles, score live, track stats.</div></div>
      <span class="bc-chev">${ICONS.chev(20)}</span>
    </a>

    <div class="card">
      <div class="card-title">Join with a code</div>
      <div style="display:flex;gap:8px">
        <input class="input" id="join-code" placeholder="e.g. k7mx2qpa…" maxlength="8" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="Event code" onkeydown="if(event.key==='Enter')joinCode()">
        <button class="btn btn-primary" style="width:auto" onclick="joinCode()">Open</button>
      </div>
    </div>

    ${recent.length ? `
    <h2 class="section-title">Your events</h2>
    ${recent.map(r => `
      <a class="recent-row" href="#/e/${esc(r.slug)}">
        <span class="recent-kind">${r.kind === 'day' ? ICONS.day(18) : ICONS.league(18)}</span>
        <span class="recent-name">${esc(r.name)}</span>
      </a>`).join('')}` : ''}

    <p class="home-foot">Tennis Klab Wimblebronx</p>
  `;
}

function joinCode() {
  const code = document.getElementById('join-code').value.trim().toLowerCase();
  if (code) location.hash = `#/e/${code}`;
}

// ── CREATE ───────────────────────────────────────────────────
let _create = null;

function renderCreate(kind) {
  _create = {
    kind,
    scoring: { type: 'total', n: 8 },
    format:  { type: 'firstto', n: 4 },
    deuce: 'sudden', courts: null   // null = auto
  };
  const isDay = kind === 'day';
  document.getElementById('view').innerHTML = `
    <a class="back-link" href="#/">← Back</a>
    <h1 class="section-title">${isDay ? 'New match day' : 'New league'}</h1>

    <div class="card">
      <div class="input-group">
        <label class="input-label" for="c-name">Name</label>
        <input class="input" id="c-name" maxlength="60" placeholder="${isDay ? 'Sunday Americano' : 'Wimblebronx League'}">
      </div>
      <div class="input-group">
        <label class="input-label" for="c-players">Players, one per line or separated by commas (${isDay ? '4 or more' : 'you can add more later'})</label>
        <textarea class="input" id="c-players" rows="4" placeholder="Ana&#10;Ben&#10;Cy&#10;Dee" oninput="updateCreatePreview()"></textarea>
      </div>
      <div id="c-added"></div>
      <div id="c-regulars"></div>
    </div>

    ${isDay ? `
    <div class="card">
      <div class="card-title">Format</div>
      <div class="format-n-row" role="group" aria-label="Courts"><span class="format-n-label">Courts</span><div class="n-picker" id="c-courts"></div></div>
      <div class="format-selector">
        <button class="fmt-btn" id="c-fmt-total" onclick="createScoring('total')">Fixed games</button>
        <button class="fmt-btn" id="c-fmt-firstto" onclick="createScoring('firstto')">First to N</button>
      </div>
      <p class="fmt-hint" id="c-fmt-hint"></p>
      <div class="format-n-row" role="group" aria-label="Games"><span class="format-n-label">Games</span><div class="n-picker" id="c-n"></div></div>
      <div class="format-n-row" role="group" aria-label="Deuce"><span class="format-n-label">Deuce</span>
        <div class="seg" id="c-deuce"></div></div>
      <div class="format-preview" id="c-preview"></div>
    </div>` : `
    <div class="card">
      <div class="card-title">First season</div>
      <div class="format-selector">
        <button class="fmt-btn" id="c-fmt-firstto" onclick="createFormat('firstto')">First to N</button>
        <button class="fmt-btn" id="c-fmt-bo" onclick="createFormat('bo')">Best of N</button>
      </div>
      <div class="format-n-row"><span class="format-n-label">Games</span><div class="n-picker" id="c-n"></div></div>
      <div class="format-preview" id="c-preview"></div>
    </div>`}

    <button class="btn btn-green" id="c-go" onclick="submitCreate()">${isDay ? 'Create match day' : 'Create league'}</button>
  `;
  updateCreatePreview();
}

function createPlayers() {
  const raw = document.getElementById('c-players')?.value || '';
  const seen = new Set();
  return raw.split(/[\n,]/).map(s => s.trim().slice(0, 24)).filter(s => {
    const k = s.toLowerCase();
    if (!s || seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// Chips under the players box: who's in (tap to remove) and regulars (tap to add)
function renderPlayerChips() {
  const names = createPlayers();
  const inSet = new Set(names.map(n => n.toLowerCase()));
  const regulars = Names.list().filter(n => !inSet.has(n.toLowerCase())).slice(0, 16);
  const chip = (n, cls, fn, label) =>
    `<button type="button" class="p-tag ${cls}" data-n="${esc(n)}" aria-label="${label} ${esc(n)}" onclick="${fn}(this.dataset.n)">${esc(n)}${cls ? ' ×' : ' +'}</button>`;
  document.getElementById('c-added').innerHTML = names.length ? `
    <div class="input-label">In (${names.length})</div>
    <div class="player-select mb-12">${names.map(n => chip(n, 'sel-b', 'createRemoveName', 'Remove')).join('')}</div>` : '';
  document.getElementById('c-regulars').innerHTML = regulars.length ? `
    <div class="input-label">Regulars, tap to add</div>
    <div class="player-select">${regulars.map(n => chip(n, '', 'createAddName', 'Add')).join('')}</div>` : '';
}

function createSetPlayers(names) {
  document.getElementById('c-players').value = names.join('\n');
  updateCreatePreview();
}
function createAddName(n)    { createSetPlayers([...createPlayers(), n]); }
function createRemoveName(n) { createSetPlayers(createPlayers().filter(x => x.toLowerCase() !== n.toLowerCase())); }

function updateCreatePreview() {
  if (!_create) return;
  const c = _create;
  const n = createPlayers().length;
  renderPlayerChips();
  const pick = (id, opts, sel, fn) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts.map(v => `<button type="button" class="n-opt ${v === sel ? 'active' : ''}" aria-pressed="${v === sel}" onclick="${fn}(${v})">${v}</button>`).join('');
  };

  if (c.kind === 'day') {
    const maxCourts = Math.max(1, Math.floor(n / 4));
    c.effCourts = Math.min(c.courts || maxCourts, maxCourts);
    pick('c-courts', [1, 2, 3, 4, 5, 6, 7, 8].filter(v => v <= maxCourts), c.effCourts, 'createCourts');
    pick('c-n', c.scoring.type === 'total' ? TOTAL_OPTS : FIRSTTO_OPTS, c.scoring.n, 'createN');
    document.getElementById('c-fmt-total').classList.toggle('active', c.scoring.type === 'total');
    document.getElementById('c-fmt-firstto').classList.toggle('active', c.scoring.type === 'firstto');
    document.getElementById('c-fmt-hint').textContent = c.scoring.type === 'total'
      ? 'Every match plays the same number of games, so rounds finish together. Draws are possible.'
      : 'A match ends when one pair reaches the target. Rounds can finish at different times.';
    document.getElementById('c-deuce').innerHTML = `
      <button class="${c.deuce === 'sudden' ? 'active' : ''}" onclick="createDeuce('sudden')">Sudden death</button>
      <button class="${c.deuce === 'full' ? 'active' : ''}" onclick="createDeuce('full')">Advantage</button>`;

    const playing = Math.min(c.effCourts, Math.floor(n / 4)) * 4;
    document.getElementById('c-preview').innerHTML = n < 4
      ? `Add at least 4 players (${n} so far).`
      : `<strong>${n} players</strong> · ${c.effCourts} court${c.effCourts > 1 ? 's' : ''} · ${formatLabel(c.scoring).toLowerCase()} per match. Round 1 is planned now; start each next round when you're ready.` +
        (n > playing ? `<br>${n - playing} sit${n - playing === 1 ? 's' : ''} out each round (rotates fairly).` : '');
  } else {
    pick('c-n', c.format.type === 'bo' ? BO_OPTS : FIRSTTO_OPTS, c.format.n, 'createN');
    document.getElementById('c-fmt-firstto').classList.toggle('active', c.format.type === 'firstto');
    document.getElementById('c-fmt-bo').classList.toggle('active', c.format.type === 'bo');
    document.getElementById('c-preview').innerHTML = `${formatLabel(c.format)} · win = 3 pts, loss = 1 pt`;
  }
}

function createCourts(v)  { _create.courts = v; updateCreatePreview(); }
function createDeuce(v)   { _create.deuce = v; updateCreatePreview(); }
function createScoring(t) { _create.scoring = { type: t, n: t === 'total' ? 8 : 4 }; updateCreatePreview(); }
function createFormat(t)  { _create.format = { type: t, n: t === 'bo' ? 7 : 4 }; updateCreatePreview(); }
function createN(v) {
  if (_create.kind === 'day') _create.scoring.n = v; else _create.format.n = v;
  updateCreatePreview();
}

async function submitCreate() {
  const c = _create;
  const names = createPlayers();
  const isDay = c.kind === 'day';
  const name = document.getElementById('c-name').value.trim() || (isDay ? `Match day ${formatDate(today())}` : 'My League');
  if (isDay && names.length < 4) { toast(`Add at least 4 players (${names.length} so far)`); document.getElementById('c-players').focus(); return; }

  const btn = document.getElementById('c-go');
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const settings = isDay
      ? { courts: c.effCourts, rounds: 1, scoring: c.scoring, deuce: c.deuce }
      : { deuce: 'sudden' };
    const { slug } = await apiCreate(c.kind, name, settings, names);

    await loadEvent(slug);
    subscribe(slug, rerender);
    if (isDay) {
      await apiOp('replace_schedule', { from_round: 1, matches: buildRounds(App.players.map(p => p.id), 1, 1) });
    } else {
      const end = new Date(); end.setMonth(end.getMonth() + 3);
      await apiOp('add_season', { name: 'Season 1', start_date: today(), end_date: end.toLocaleDateString('en-CA'), format: c.format });
      App.seasonId = App.seasons.at(-1).id;
    }
    location.hash = `#/e/${slug}`;
    setTimeout(openInvite, 300);
  } catch (e) {
    console.error(e);
    toast('Could not create it: ' + (e.message || e) + '. Check your connection and try again.', 5000);
    btn.disabled = false; btn.textContent = 'Try again';
  }
}

// ── BOOT ─────────────────────────────────────────────────────
window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

// A phone waking up missed the "changed" messages: reload the event.
// Skipped while this phone holds unsaved scores, which a reload would wipe.
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !App.slug || savesPending()) return;
  try { if (await loadEvent(App.slug)) rerender(); } catch (e) { console.error(e); }
});

(async () => {
  document.getElementById('loading-screen').style.display = 'none';
  await route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
