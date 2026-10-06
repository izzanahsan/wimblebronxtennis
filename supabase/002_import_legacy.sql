-- ════════════════════════════════════════════════════════════
-- Copy the original Wimblebronx league (tables players, seasons,
-- matches, availability) into a v2 league event.
-- Run AFTER 001_events.sql. The old tables are left untouched.
--
-- The result row shows { slug, key }. SAVE THE KEY — it's the
-- organizer key for the league and is not stored anywhere in plain text.
-- Running it a second time does nothing and returns the existing slug.
-- ════════════════════════════════════════════════════════════

create or replace function ev_import_legacy() returns json
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_res json; v_ev bigint; v_new bigint;
  pm jsonb := '{}';  -- old player id → new
  sm jsonb := '{}';  -- old season id → new
  x record;
begin
  select id into v_ev from events where settings->>'legacy' = 'true';
  if v_ev is not null then
    return json_build_object('already_imported', (select slug from events where id = v_ev));
  end if;

  v_res := create_event('league', 'Wimblebronx', '{"legacy":true}', '{}');
  select id into v_ev from events where slug = v_res->>'slug';

  for x in select * from players order by id loop
    insert into ev_players (event_id, name, photo_url, active)
    values (v_ev, left(x.name, 24), x.photo_url,
            coalesce((select a.available from availability a where a.player_id = x.id), true))
    returning id into v_new;
    pm := pm || jsonb_build_object(x.id::text, v_new);
  end loop;

  for x in select * from seasons order by id loop
    insert into ev_seasons (event_id, name, start_date, end_date, format, winner)
    values (v_ev, left(x.name, 40), x.start_date::date, x.end_date::date,
            coalesce(x.format::text::jsonb, '{"type":"firstto","n":4}'), x.winner)
    returning id into v_new;
    sm := sm || jsonb_build_object(x.id::text, v_new);
  end loop;

  -- Players deleted in the old app are dropped from their teams
  for x in select * from matches order by id loop
    insert into ev_matches (event_id, season_id, date, team_a, team_b, score_a, score_b, status)
    values (v_ev, (sm->>x.season_id::text)::bigint, x.date::date,
            array(select (pm->>e)::bigint from jsonb_array_elements_text(to_jsonb(x.team_a)) e where pm ? e),
            array(select (pm->>e)::bigint from jsonb_array_elements_text(to_jsonb(x.team_b)) e where pm ? e),
            x.games_a, x.games_b, 'done');
  end loop;

  return v_res;
end $$;

select ev_import_legacy() as save_this;
drop function ev_import_legacy();
