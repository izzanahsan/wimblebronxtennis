-- ════════════════════════════════════════════════════════════
-- Lock the original Wimblebronx tables after importing them (002).
-- The public (anon) key can no longer read or change them; they stay
-- in the database as a backup, visible in the Supabase dashboard.
-- To undo: grant select, insert, update, delete on <table> to anon;
-- ════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['players', 'seasons', 'season_players', 'matches',
                           'availability', 'locked_dates', 'live_match'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon, authenticated', t);
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;
