-- supabase/migrations/0037_fix_buddy_peek_date_skew.sql
--
-- THROWAWAY TEST DATA, same as 0035. 0035 ran while the server's UTC clock
-- still said 2026-09-01, but chocopndn's device local date was already
-- 2026-09-02 (UTC+ timezone, past local midnight before UTC rolled over) --
-- so the seeded "year ago" pair landed on 2025-09-01, one day off from what
-- the app's client-local-date query actually asks for (2025-09-02).
-- Confirmed via 0036's diagnostic: get_buddy_peek matched correctly against
-- server current_date, the mismatch is purely the UTC-vs-local skew.
--
-- Adds a second pair on 2025-09-02 alongside 0035's 2025-09-01 pair rather
-- than deleting/moving it -- harmless either way, and covers the exact
-- rollover window without needing to know precisely which day is "right".
do $$
declare
  me_id uuid;
  buddy_id uuid;
  local_year_ago date := '2025-09-02';
  photo1_path text;
  photo2_path text;
begin
  select id into me_id from public.profiles where username = 'chocopndn';
  select id into buddy_id from public.profiles where username = 'piqa_test_buddy';
  if me_id is null or buddy_id is null then
    raise exception 'chocopndn or piqa_test_buddy profile not found -- aborting';
  end if;

  select storage_path into photo1_path from public.captures where user_id = me_id order by captured_at desc limit 1 offset 0;
  select storage_path into photo2_path from public.captures where user_id = me_id order by captured_at desc limit 1 offset 1;
  if photo2_path is null then
    photo2_path := photo1_path;
  end if;

  execute 'alter table public.captures disable trigger on_capture_update_streak';

  insert into public.captures (id, user_id, storage_path, captured_at) values
    (gen_random_uuid(), me_id, photo1_path, local_year_ago),
    (gen_random_uuid(), buddy_id, photo2_path, local_year_ago);

  execute 'alter table public.captures enable trigger on_capture_update_streak';
end $$;
