-- ════════════════════════════════════════════════════════════
-- Open editing: anyone with an event's link can score and edit.
-- The organizer key is no longer checked. Run once in Supabase → SQL Editor.
-- To undo: re-run the ev_admin_id function from 001_events.sql.
-- ════════════════════════════════════════════════════════════

create or replace function ev_admin_id(p_slug text, p_key text) returns bigint
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_id bigint;
begin
  select id into v_id from events where slug = p_slug;
  if v_id is null then raise exception 'event not found' using errcode = 'P0002'; end if;
  return v_id;
end $$;
