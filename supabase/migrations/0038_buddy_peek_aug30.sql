-- supabase/migrations/0038_buddy_peek_aug30.sql
--
-- THROWAWAY TEST DATA, same as 0035. Seeds the Buddy Peek match on a fixed
-- absolute date (2026-08-30, chocopndn's own first real capture per them
-- directly) instead of an interval computed relative to current_date at
-- migration-push time -- 0035/0037 both got bitten by server-UTC-vs-
-- device-local date skew computing "today - N", this sidesteps that class
-- of bug entirely: whichever offset (7d/1mo/1yr) the client's own real
-- "today" actually lands 2026-08-30 on, get_buddy_peek matches it live.
--
-- Only inserts for the test buddy -- chocopndn's own side of the match is
-- their real existing Aug 30 capture, not a fabricated duplicate, so this
-- doesn't touch their account's data at all (no streak-trigger workaround
-- needed either, since nothing is inserted for their user_id here).
do $$
declare
  me_id uuid;
  buddy_id uuid;
  target_date date := '2026-08-30';
  my_existing_capture_count int;
  photo_for_buddy text;
begin
  select id into me_id from public.profiles where username = 'chocopndn';
  select id into buddy_id from public.profiles where username = 'piqa_test_buddy';
  if me_id is null or buddy_id is null then
    raise exception 'chocopndn or piqa_test_buddy profile not found -- aborting';
  end if;

  select count(*) into my_existing_capture_count
    from public.captures where user_id = me_id and captured_at = target_date;
  if my_existing_capture_count = 0 then
    raise exception 'chocopndn has no existing capture on % -- expected a real one there', target_date;
  end if;

  select storage_path into photo_for_buddy
    from public.captures where user_id = me_id order by captured_at desc limit 1;

  insert into public.captures (id, user_id, storage_path, captured_at)
  values (gen_random_uuid(), buddy_id, photo_for_buddy, target_date);
end $$;
