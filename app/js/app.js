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
    if (key) {
      // Organizer link: remember the key, then drop it from the address bar
      if (await apiCheckKey(slug, key)) { Keys.set(slug, key); toast('🔑 You are an organizer of this event'); }
      else toast('⚠️ That organizer key is not valid');
      history.replaceState(null, '', `#/${parts.join('/')}`);
    }
    if (App.slug !== slug) {
      setHeader(null);
      document.getElementById('view').innerHTML = '<div class="loading-inline"><div class="loading-spinner"></div></div>';
      let ok = false;
      try { ok = await loadEvent(slug); } catch (e) { console.error(e); }
      if (!ok) {
        App.slug = null;
        document.getElementById('view').innerHTML = `<div class="empty">Event not found.<br><a href="#/">Go home</a></div>`;
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
  App.isAdmin = !!Keys.get(App.slug);

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
      <a href="#/" class="ev-home" aria-label="Home">🎾</a>
      <div class="ev-title-wrap">
        <div class="ev-title">${esc(ev.name)}</div>
        <div class="ev-sub">
          ${ev.kind === 'day' ? 'Americano' : 'League'}
          ${ev.kind === 'league' && season ? ` · <span class="season-badge" onclick="openSeasonSwitcher()">${esc(season.name)} ▾</span>` : ''}
          ${App.isAdmin ? ' · <span class="org-badge">Organizer</span>' : ''}
        </div>
      </div>
      <button class="icon-btn" onclick="openInvite()" aria-label="Share links">🔗</button>
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
      <div class="input-label">👀 Players & spectators — view only</div>
      <div class="link-row"><code>${esc(viewLink(s))}</code><button class="btn-mini" onclick="copyText('${viewLink(s)}','View link')">Copy</button></div>
    </div>
    ${App.isAdmin ? `
    <div class="link-box">
      <div class="input-label">🔑 Organizer — can enter scores and edit</div>
      <div class="link-row"><code>${esc(organizerLink(s))}</code><button class="btn-mini" onclick="copyText('${organizerLink(s)}','Organizer link')">Copy</button></div>
      <p class="text-sm text-muted mt-8">Send this only to people who should keep score. Save it somewhere — it's the only way to edit from another phone.</p>
    </div>` : ''}
    <div class="text-sm text-muted">Event code: <strong>${esc(s)}</strong></div>
  `);
}

// ── HOME ─────────────────────────────────────────────────────
function renderHome() {
  const recent = Recent.list();
  document.getElementById('view').innerHTML = `
    <div class="hero">
      <img src="icon-192.png" alt="" class="hero-logo">
      <div class="logo">Wimblebronx</div>
      <p class="text-muted">Tennis Tracker for Bronxpeople!</p>
    </div>

    <a class="big-choice" href="#/new/day">
      <div class="bc-icon">⚡</div>
      <div><div class="bc-title">Start a match day</div><div class="bc-sub">Americano — partners rotate, everyone plays everyone. Live scores + IG results.</div></div>
    </a>
    <a class="big-choice" href="#/new/league">
      <div class="bc-icon">🏆</div>
      <div><div class="bc-title">Create a league</div><div class="bc-sub">Ongoing standings across seasons. Randomize doubles, score live, track stats.</div></div>
    </a>

    <div class="card">
      <div class="card-title">Join with a code</div>
      <div style="display:flex;gap:8px">
        <input class="input" id="join-code" placeholder="e.g. k7mx2qpa" maxlength="8" autocapitalize="off" autocomplete="off">
        <button class="btn btn-primary" style="width:auto" onclick="joinCode()">Open</button>
      </div>
    </div>

    ${recent.length ? `
    <p class="section-title">Your events</p>
    ${recent.map(r => `
      <a class="recent-row" href="#/e/${esc(r.slug)}">
        <span class="recent-kind">${r.kind === 'day' ? '⚡' : '🏆'}</span>
        <span class="recent-name">${esc(r.name)}</span>
        ${Keys.get(r.slug) ? '<span class="org-badge">Organizer</span>' : ''}
      </a>`).join('')}` : ''}
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
    deuce: 'sudden', courts: null, rounds: null   // null = auto
  };
  const isDay = kind === 'day';
  document.getElementById('view').innerHTML = `
    <a class="back-link" href="#/">← Back</a>
    <p class="section-title">${isDay ? '⚡ New match day' : '🏆 New league'}</p>

    <div class="card">
      <div class="input-group">
        <label class="input-label">Name</label>
        <input class="input" id="c-name" maxlength="60" placeholder="${isDay ? 'Sunday Americano' : 'Wimblebronx League'}">
      </div>
      <div class="input-group">
        <label class="input-label">Players — one per line (${isDay ? '4 or more' : 'you can add more later'})</label>
        <textarea class="input" id="c-players" rows="6" placeholder="Ana&#10;Ben&#10;Cy&#10;Dee" oninput="updateCreatePreview()"></textarea>
      </div>
    </div>

    ${isDay ? `
    <div class="card">
      <div class="card-title">Format</div>
      <div class="format-n-row"><span class="format-n-label">Courts</span><div class="n-picker" id="c-courts"></div></div>
      <div class="format-n-row"><span class="format-n-label">Rounds</span><div class="n-picker" id="c-rounds"></div></div>
      <div class="format-selector">
        <button class="fmt-btn" id="c-fmt-total" onclick="createScoring('total')">Fixed games</button>
        <button class="fmt-btn" id="c-fmt-firstto" onclick="createScoring('firstto')">First to N</button>
      </div>
      <div class="format-n-row"><span class="format-n-label">Games</span><div class="n-picker" id="c-n"></div></div>
      <div class="format-n-row"><span class="format-n-label">Deuce</span>
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

    <button class="btn btn-green" id="c-go" onclick="submitCreate()">${isDay ? '🚀 Create match day' : '🚀 Create league'}</button>
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

function suggestedRounds(n, courts) {
  const perRound = Math.min(courts, Math.floor(n / 4)) * 4;
  if (!perRound) return 0;
  // everyone partners everyone once ≈ n-1 rounds when nobody sits out
  return perRound === n ? n - 1 : Math.min(n, 12);
}

function updateCreatePreview() {
  if (!_create) return;
  const c = _create;
  const n = createPlayers().length;
  const pick = (id, opts, sel, fn) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts.map(v => `<div class="n-opt ${v === sel ? 'active' : ''}" onclick="${fn}(${v})">${v}</div>`).join('');
  };

  if (c.kind === 'day') {
    const maxCourts = Math.max(1, Math.floor(n / 4));
    c.effCourts = Math.min(c.courts || maxCourts, maxCourts);
    const rounds = c.rounds ?? suggestedRounds(n, c.effCourts);
    pick('c-courts', [1, 2, 3, 4, 5, 6, 7, 8].filter(v => v <= maxCourts), c.effCourts, 'createCourts');
    pick('c-rounds', [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15].concat(rounds && ![3,4,5,6,7,8,9,10,11,12,15].includes(rounds) ? [rounds] : []).sort((a, b) => a - b), rounds, 'createRounds');
    pick('c-n', c.scoring.type === 'total' ? TOTAL_OPTS : FIRSTTO_OPTS, c.scoring.n, 'createN');
    document.getElementById('c-fmt-total').classList.toggle('active', c.scoring.type === 'total');
    document.getElementById('c-fmt-firstto').classList.toggle('active', c.scoring.type === 'firstto');
    document.getElementById('c-deuce').innerHTML = `
      <button class="${c.deuce === 'sudden' ? 'active' : ''}" onclick="createDeuce('sudden')">Sudden death</button>
      <button class="${c.deuce === 'full' ? 'active' : ''}" onclick="createDeuce('full')">Advantage</button>`;

    const playing = Math.min(c.effCourts, Math.floor(n / 4)) * 4;
    document.getElementById('c-preview').innerHTML = n < 4
      ? `Add at least 4 players (${n} so far).`
      : `<strong>${n} players</strong> · ${c.effCourts} court${c.effCourts > 1 ? 's' : ''} · <strong>${rounds} rounds</strong> of ${formatLabel(c.scoring).toLowerCase()}` +
        (n > playing ? `<br>${n - playing} sit${n - playing === 1 ? 's' : ''} out each round (rotates fairly).` : '');
  } else {
    pick('c-n', c.format.type === 'bo' ? BO_OPTS : FIRSTTO_OPTS, c.format.n, 'createN');
    document.getElementById('c-fmt-firstto').classList.toggle('active', c.format.type === 'firstto');
    document.getElementById('c-fmt-bo').classList.toggle('active', c.format.type === 'bo');
    document.getElementById('c-preview').innerHTML = `${formatLabel(c.format)} · win = 3 pts, loss = 1 pt`;
  }
}

function createCourts(v)  { _create.courts = v; _create.rounds = null; updateCreatePreview(); }
function createRounds(v)  { _create.rounds = v; updateCreatePreview(); }
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
  if (isDay && names.length < 4) { toast('⚠️ Add at least 4 players'); return; }

  const btn = document.getElementById('c-go');
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const rounds = c.rounds ?? suggestedRounds(names.length, c.effCourts);
    const settings = isDay
      ? { courts: c.effCourts, rounds, scoring: c.scoring, deuce: c.deuce, seed: Math.floor(Math.random() * 1e9) }
      : { deuce: 'sudden' };
    const { slug } = await apiCreate(c.kind, name, settings, names);

    await loadEvent(slug);
    subscribe(slug, rerender);
    if (isDay) {
      await apiOp('replace_schedule', { from_round: 1, matches: buildRounds(App.players.map(p => p.id), 1, rounds) });
    } else {
      const end = new Date(); end.setMonth(end.getMonth() + 3);
      await apiOp('add_season', { name: 'Season 1', start_date: today(), end_date: end.toLocaleDateString('en-CA'), format: c.format });
      App.seasonId = App.seasons.at(-1).id;
    }
    location.hash = `#/e/${slug}`;
    setTimeout(openInvite, 300);
  } catch (e) {
    console.error(e);
    toast('❌ Could not create: ' + (e.message || e), 5000);
    btn.disabled = false; btn.textContent = 'Try again';
  }
}

// ── BOOT ─────────────────────────────────────────────────────
window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

(async () => {
  document.getElementById('loading-screen').style.display = 'none';
  await route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
