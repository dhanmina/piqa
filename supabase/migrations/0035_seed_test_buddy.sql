-- supabase/migrations/0035_seed_test_buddy.sql
--
-- THROWAWAY TEST DATA, not real schema/product SQL. Creates one synthetic
-- "test buddy" account, an accepted streak_buddies relationship with
-- chocopndn's real account, and a matching Buddy Peek capture pair (dated
-- exactly 1 year ago, a date the app didn't exist on yet, so it can't
-- collide with any real capture history) -- purely so buddy removal,
-- cancel-request, and Buddy Peek can be exercised on-device without a
-- second real phone/account. Delete this account before launch (drop the
-- 'piqa_test_buddy' profile's auth.users row; every other row this
-- migration inserts cascades from that FK).
--
-- Reuses chocopndn's own two most-recent already-uploaded photos for both
-- sides of the pair rather than fabricating storage paths with nothing
-- behind them or needing a service-role key to upload new files.
do $$
declare
  me_id uuid;
  buddy_id uuid;
  photo1_path text;
  photo2_path text;
  a_year_ago date := (current_date - interval '1 year')::date;
begin
  select id into me_id from public.profiles where username = 'chocopndn';
  if me_id is null then
    raise exception 'No profile found with username chocopndn -- aborting seed';
  end if;

  select storage_path into photo1_path from public.captures where user_id = me_id order by captured_at desc limit 1 offset 0;
  select storage_path into photo2_path from public.captures where user_id = me_id order by captured_at desc limit 1 offset 1;
  if photo1_path is null then
    raise exception 'chocopndn has no existing captures to reuse a photo from -- aborting seed';
  end if;
  if photo2_path is null then
    photo2_path := photo1_path;
  end if;

  buddy_id := gen_random_uuid();
  insert into auth.users (id, email) values (buddy_id, 'test-buddy@piqa.test');
  update public.profiles set username = 'piqa_test_buddy', display_name = 'Test Buddy' where id = buddy_id;

  insert into public.streak_buddies (requester_id, recipient_id, status, responded_at)
  values (buddy_id, me_id, 'accepted', now());

  -- record_capture_streak (0003) recalculates current_count/longest_count on every
  -- capture insert relative to the account's existing last_capture_date -- a
  -- backdated row would read as a broken streak and reset your real
  -- current_count to 1. Disabled only for this one seed insert.
  execute 'alter table public.captures disable trigger on_capture_update_streak';

  insert into public.captures (id, user_id, storage_path, captured_at) values
    (gen_random_uuid(), me_id, photo1_path, a_year_ago),
    (gen_random_uuid(), buddy_id, photo2_path, a_year_ago);

  execute 'alter table public.captures enable trigger on_capture_update_streak';
end $$;
