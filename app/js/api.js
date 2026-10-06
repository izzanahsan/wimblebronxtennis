// ── APP STATE ────────────────────────────────────────────────
// The open event. Rows come straight from get_event (snake_case).
const App = {
  slug:     null,
  event:    null,   // { id, slug, kind: 'day'|'league', name, settings }
  players:  [],     // [{ id, name, photo_url, active }]
  seasons:  [],     // [{ id, name, start_date, end_date, format, winner }]
  matches:  [],     // [{ id, season_id, round, court, date, team_a, team_b, score_a, score_b, status, points, live }]
  isAdmin:  false,
  seasonId: null,   // league: season being viewed
  channel:  null
};

function player(id)     { return App.players.find(p => p.id === id); }
function teamNames(ids) { return (ids || []).map(id => player(id)?.name || '?').join(' & '); }

// ── LOCAL STORAGE (organizer keys + recently opened) ─────────
function _store(name, fallback) {
  try { return JSON.parse(localStorage.getItem(name)) ?? fallback; } catch { return fallback; }
}
function _save(name, val) { try { localStorage.setItem(name, JSON.stringify(val)); } catch {} }

const Keys = {
  get(slug)      { return _store('wb_keys', {})[slug] || null; },
  set(slug, key) { const k = _store('wb_keys', {}); k[slug] = key; _save('wb_keys', k); },
  del(slug)      { const k = _store('wb_keys', {}); delete k[slug]; _save('wb_keys', k); }
};

const Recent = {
  list()   { return _store('wb_recent', []); },
  add(ev)  {
    const list = Recent.list().filter(x => x.slug !== ev.slug);
    list.unshift({ slug: ev.slug, name: ev.name, kind: ev.kind, at: Date.now() });
    _save('wb_recent', list.slice(0, 20));
  },
  remove(slug) { _save('wb_recent', Recent.list().filter(x => x.slug !== slug)); }
};

// ── LINKS ────────────────────────────────────────────────────
function baseUrl()           { return location.origin + location.pathname; }
function viewLink(slug)      { return `${baseUrl()}#/e/${slug}`; }
function organizerLink(slug) { return `${baseUrl()}#/e/${slug}?k=${Keys.get(slug)}`; }

// ── RPC ──────────────────────────────────────────────────────
async function apiCreate(kind, name, settings, players) {
  const { data, error } = await sb.rpc('create_event', {
    p_kind: kind, p_name: name, p_settings: settings, p_players: players
  });
  if (error) throw error;
  Keys.set(data.slug, data.key);
  return data;
}

async function apiGet(slug) {
  const { data, error } = await sb.rpc('get_event', { p_slug: slug });
  if (error) throw error;
  return data;
}

async function apiCheckKey(slug, key) {
  const { data, error } = await sb.rpc('check_key', { p_slug: slug, p_key: key });
  return !error && data === true;
}

// Write to the open event, merge the result into App, tell other viewers
async function apiOp(op, data = {}) {
  const { data: row, error } = await sb.rpc('admin_op', {
    p_slug: App.slug, p_key: Keys.get(App.slug), p_op: op, p_data: data
  });
  if (error) {
    toast('❌ ' + (error.message || 'Save failed'), 4000);
    console.error(op, error);
    throw error;
  }
  applyOp(op, data, row);
  notifyChange();
  return row;
}

function _upsert(list, row) {
  const i = list.findIndex(x => x.id === row.id);
  if (i >= 0) list[i] = row; else list.push(row);
}

function applyOp(op, data, row) {
  switch (op) {
    case 'update_event':     Object.assign(App.event, row); break;
    case 'add_player':
    case 'update_player':    _upsert(App.players, row); break;
    case 'delete_player':    App.players = App.players.filter(p => p.id !== data.id); break;
    case 'add_season':
    case 'update_season':    _upsert(App.seasons, row); break;
    case 'delete_season':
      App.seasons = App.seasons.filter(s => s.id !== data.id);
      App.matches = App.matches.filter(m => m.season_id !== data.id);
      break;
    case 'save_match':       _upsert(App.matches, row); break;
    case 'delete_match':     App.matches = App.matches.filter(m => m.id !== data.id); break;
    case 'replace_schedule': App.matches = row; break;
  }
}

// ── LOAD ─────────────────────────────────────────────────────
async function loadEvent(slug) {
  const d = await apiGet(slug);
  if (!d) return false;
  App.slug    = slug;
  App.event   = d.event;
  App.players = d.players;
  App.seasons = d.seasons;
  App.matches = d.matches;
  App.isAdmin = !!Keys.get(slug);
  if (!App.seasons.find(s => s.id === App.seasonId)) App.seasonId = App.seasons.at(-1)?.id ?? null;
  Recent.add(App.event);
  return true;
}

// ── REALTIME ─────────────────────────────────────────────────
// Writers broadcast "changed"; everyone else refetches the event.
let _refetchTimer = null;

function subscribe(slug, onChange) {
  if (App.channel) sb.removeChannel(App.channel);
  App.channel = sb.channel('ev-' + slug, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'changed' }, () => {
      clearTimeout(_refetchTimer);
      _refetchTimer = setTimeout(async () => {
        if (App.slug !== slug) return;
        try { if (await loadEvent(slug)) onChange(); } catch (e) { console.error(e); }
      }, 250);
    })
    .subscribe();
}

function unsubscribe() {
  if (App.channel) sb.removeChannel(App.channel);
  App.channel = null;
}

function notifyChange() {
  App.channel?.send({ type: 'broadcast', event: 'changed', payload: {} });
}
