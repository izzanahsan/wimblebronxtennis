-- ════════════════════════════════════════════════════════════
-- Wimblebronx v2 — multi-group events (Americano days + leagues)
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Access model (no logins):
--   • Anyone with an event's slug can READ it      → get_event(slug)
--   • Anyone with its organizer key can WRITE it   → admin_op(slug, key, op, data)
-- Tables have RLS on and no policies, so the anon key cannot touch
-- them directly; everything goes through these functions.
-- ════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists events (
  id          bigint generated always as identity primary key,
  slug        text unique not null,
  kind        text not null check (kind in ('day', 'league')),
  name        text not null check (char_length(name) between 1 and 60),
  settings    jsonb not null default '{}',
  admin_hash  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists ev_players (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references events(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 24),
  photo_url  text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ev_seasons (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references events(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  start_date  date,
  end_date    date,
  format      jsonb not null default '{"type":"firstto","n":4}',
  winner      text
);

create table if not exists ev_matches (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references events(id) on delete cascade,
  season_id   bigint references ev_seasons(id) on delete cascade,
  round       int,
  court       int,
  date        date not null default current_date,
  team_a      bigint[] not null,
  team_b      bigint[] not null,
  score_a     int check (score_a >= 0),
  score_b     int check (score_b >= 0),
  status      text not null default 'scheduled' check (status in ('scheduled', 'live', 'done')),
  points      jsonb,   -- point log { deuce, w, s } from the live scorer
  live        jsonb,   -- in-progress state { ptA, ptB, serve } while status = 'live'
  updated_at  timestamptz not null default now()
);

create index if not exists ev_players_event on ev_players(event_id);
create index if not exists ev_seasons_event on ev_seasons(event_id);
create index if not exists ev_matches_event on ev_matches(event_id);

alter table events     enable row level security;
alter table ev_players enable row level security;
alter table ev_seasons enable row level security;
alter table ev_matches enable row level security;

-- ── helpers (not callable by clients) ───────────────────────

create or replace function ev_hash(p_key text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(digest(coalesce(p_key, ''), 'sha256'), 'hex')
$$;

create or replace function ev_token(p_len int) returns text
language sql volatile set search_path = public, extensions as $$
  -- lowercase letters + digits without look-alikes (no 0/o/1/l/i)
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from (select gen_random_bytes(p_len) as b) r, generate_series(0, p_len - 1) i
$$;

create or replace function ev_admin_id(p_slug text, p_key text) returns bigint
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_id bigint;
begin
  select id into v_id from events where slug = p_slug and admin_hash = ev_hash(p_key);
  if v_id is null then raise exception 'not authorized' using errcode = '42501'; end if;
  return v_id;
end $$;

-- Every id in the teams must be a player of this event
create or replace function ev_check_teams(p_event bigint, p_a bigint[], p_b bigint[]) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_all bigint[] := p_a || p_b;
begin
  if cardinality(p_a) not between 1 and 2 or cardinality(p_b) not between 1 and 2 then
    raise exception 'teams must have 1 or 2 players';
  end if;
  if (select count(distinct x) from unnest(v_all) x) <> cardinality(v_all) then
    raise exception 'a player cannot be on both teams';
  end if;
  if (select count(*) from ev_players where event_id = p_event and id = any(v_all)) <> cardinality(v_all) then
    raise exception 'unknown player';
  end if;
end $$;

-- ── public API ──────────────────────────────────────────────

-- Create an event; returns { slug, key }. The key is shown once and only its hash is stored.
create or replace function create_event(p_kind text, p_name text, p_settings jsonb, p_players text[])
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_slug text; v_key text; v_id bigint; v_name text;
begin
  if coalesce(cardinality(p_players), 0) > 40 then raise exception 'max 40 players'; end if;

  loop
    v_slug := ev_token(8);
    exit when not exists (select 1 from events where slug = v_slug);
  end loop;
  v_key := ev_token(20);

  insert into events (slug, kind, name, settings, admin_hash)
  values (v_slug, p_kind, trim(p_name), coalesce(p_settings, '{}'), ev_hash(v_key))
  returning id into v_id;

  foreach v_name in array coalesce(p_players, '{}') loop
    if trim(v_name) <> '' then
      insert into ev_players (event_id, name) values (v_id, trim(v_name));
    end if;
  end loop;

  return json_build_object('slug', v_slug, 'key', v_key);
end $$;

-- Everything a viewer needs, in one round trip
create or replace function get_event(p_slug text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'event',   (select json_build_object('id', e.id, 'slug', e.slug, 'kind', e.kind, 'name', e.name,
                                         'settings', e.settings, 'created_at', e.created_at, 'updated_at', e.updated_at)),
    'players', coalesce((select json_agg(p order by p.id) from ev_players p where p.event_id = e.id), '[]'),
    'seasons', coalesce((select json_agg(s order by s.id) from ev_seasons s where s.event_id = e.id), '[]'),
    'matches', coalesce((select json_agg(m order by m.id) from ev_matches m where m.event_id = e.id), '[]')
  )
  from events e where e.slug = p_slug
$$;

create or replace function check_key(p_slug text, p_key text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from events where slug = p_slug and admin_hash = ev_hash(p_key))
$$;

-- All writes. Returns the affected row (or a list for bulk ops).
create or replace function admin_op(p_slug text, p_key text, p_op text, p_data jsonb)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_ev  bigint := ev_admin_id(p_slug, p_key);
  v_id  bigint := nullif(p_data->>'id', '')::bigint;
  v_out json;
  v_m   jsonb;
  v_a   bigint[];
  v_b   bigint[];
begin
  update events set updated_at = now() where id = v_ev;

  case p_op

  when 'update_event' then
    update events set
      name     = coalesce(trim(p_data->>'name'), name),
      settings = coalesce(p_data->'settings', settings)
    where id = v_ev
    returning json_build_object('id', id, 'name', name, 'settings', settings) into v_out;

  when 'delete_event' then
    delete from events where id = v_ev;
    v_out := json_build_object('deleted', true);

  when 'add_player' then
    if (select count(*) from ev_players where event_id = v_ev) >= 40 then raise exception 'max 40 players'; end if;
    insert into ev_players (event_id, name) values (v_ev, trim(p_data->>'name'))
    returning row_to_json(ev_players.*) into v_out;

  when 'update_player' then
    update ev_players set
      name      = coalesce(trim(p_data->>'name'), name),
      photo_url = case when p_data ? 'photo_url' then p_data->>'photo_url' else photo_url end,
      active    = coalesce((p_data->>'active')::boolean, active)
    where id = v_id and event_id = v_ev
    returning row_to_json(ev_players.*) into v_out;

  when 'delete_player' then
    delete from ev_players where id = v_id and event_id = v_ev;
    v_out := json_build_object('id', v_id);

  when 'add_season' then
    insert into ev_seasons (event_id, name, start_date, end_date, format)
    values (v_ev, trim(p_data->>'name'), (p_data->>'start_date')::date, (p_data->>'end_date')::date,
            coalesce(p_data->'format', '{"type":"firstto","n":4}'))
    returning row_to_json(ev_seasons.*) into v_out;

  when 'update_season' then
    update ev_seasons set
      name       = coalesce(trim(p_data->>'name'), name),
      start_date = coalesce((p_data->>'start_date')::date, start_date),
      end_date   = coalesce((p_data->>'end_date')::date, end_date),
      format     = coalesce(p_data->'format', format),
      winner     = case when p_data ? 'winner' then p_data->>'winner' else winner end
    where id = v_id and event_id = v_ev
    returning row_to_json(ev_seasons.*) into v_out;

  when 'delete_season' then
    delete from ev_seasons where id = v_id and event_id = v_ev;
    v_out := json_build_object('id', v_id);

  when 'save_match' then
    -- Insert when no id, otherwise update only the fields sent
    if v_id is null then
      v_a := array(select jsonb_array_elements_text(p_data->'team_a')::bigint);
      v_b := array(select jsonb_array_elements_text(p_data->'team_b')::bigint);
      perform ev_check_teams(v_ev, v_a, v_b);
      if p_data->>'season_id' is not null and not exists
         (select 1 from ev_seasons where id = (p_data->>'season_id')::bigint and event_id = v_ev) then
        raise exception 'unknown season';
      end if;
      insert into ev_matches (event_id, season_id, round, court, date, team_a, team_b,
                              score_a, score_b, status, points, live)
      values (v_ev, (p_data->>'season_id')::bigint, (p_data->>'round')::int, (p_data->>'court')::int,
              coalesce((p_data->>'date')::date, current_date), v_a, v_b,
              (p_data->>'score_a')::int, (p_data->>'score_b')::int,
              coalesce(p_data->>'status', 'done'), p_data->'points', p_data->'live')
      returning row_to_json(ev_matches.*) into v_out;
    else
      if p_data ? 'team_a' or p_data ? 'team_b' then
        select case when p_data ? 'team_a' then array(select jsonb_array_elements_text(p_data->'team_a')::bigint) else team_a end,
               case when p_data ? 'team_b' then array(select jsonb_array_elements_text(p_data->'team_b')::bigint) else team_b end
          into v_a, v_b from ev_matches where id = v_id and event_id = v_ev;
        if v_a is not null then perform ev_check_teams(v_ev, v_a, v_b); end if;
      end if;
      update ev_matches set
        team_a     = coalesce(v_a, team_a),
        team_b     = coalesce(v_b, team_b),
        court      = case when p_data ? 'court'   then (p_data->>'court')::int   else court   end,
        score_a    = case when p_data ? 'score_a' then (p_data->>'score_a')::int else score_a end,
        score_b    = case when p_data ? 'score_b' then (p_data->>'score_b')::int else score_b end,
        status     = coalesce(p_data->>'status', status),
        points     = case when p_data ? 'points'  then p_data->'points' else points end,
        live       = case when p_data ? 'live'    then p_data->'live'   else live   end,
        updated_at = now()
      where id = v_id and event_id = v_ev
      returning row_to_json(ev_matches.*) into v_out;
    end if;

  when 'delete_match' then
    delete from ev_matches where id = v_id and event_id = v_ev;
    v_out := json_build_object('id', v_id);

  when 'replace_schedule' then
    -- Americano: drop rounds that haven't started and insert the new ones
    delete from ev_matches where event_id = v_ev and status = 'scheduled' and round is not null;
    for v_m in select * from jsonb_array_elements(p_data->'matches') loop
      v_a := array(select jsonb_array_elements_text(v_m->'team_a')::bigint);
      v_b := array(select jsonb_array_elements_text(v_m->'team_b')::bigint);
      perform ev_check_teams(v_ev, v_a, v_b);
      insert into ev_matches (event_id, round, court, team_a, team_b, status)
      values (v_ev, (v_m->>'round')::int, (v_m->>'court')::int, v_a, v_b, 'scheduled');
    end loop;
    select coalesce(json_agg(m order by m.id), '[]') into v_out from ev_matches m where m.event_id = v_ev;

  else
    raise exception 'unknown op %', p_op;
  end case;

  if v_out is null then raise exception 'not found'; end if;
  return v_out;
end $$;

-- ── grants ──────────────────────────────────────────────────
revoke all on events, ev_players, ev_seasons, ev_matches from anon, authenticated;
revoke all on function ev_hash(text), ev_token(int), ev_admin_id(text, text),
                       ev_check_teams(bigint, bigint[], bigint[]) from public, anon, authenticated;
grant execute on function create_event(text, text, jsonb, text[]),
                          get_event(text), check_key(text, text),
                          admin_op(text, text, text, jsonb) to anon, authenticated;
