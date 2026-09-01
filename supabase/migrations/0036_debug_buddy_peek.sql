-- supabase/migrations/0036_debug_buddy_peek.sql
--
-- DIAGNOSTIC ONLY, read-only -- no schema/data change. Investigating why
-- get_buddy_peek returns nothing for chocopndn despite 0035's seed. Output
-- via RAISE NOTICE, inspected in this session's db push output.
do $$
declare
  me_id uuid;
  buddy_id uuid;
  a_year_ago date := (current_date - interval '1 year')::date;
  my_cap_count int;
  buddy_cap_count int;
  rel_status text;
  my_paths text;
  buddy_paths text;
  peek_result jsonb;
begin
  select id into me_id from public.profiles where username = 'chocopndn';
  select id into buddy_id from public.profiles where username = 'piqa_test_buddy';

  select count(*), string_agg(storage_path || '@' || captured_at::text, ', ')
    into my_cap_count, my_paths
    from public.captures where user_id = me_id and captured_at = a_year_ago;
  select count(*), string_agg(storage_path || '@' || captured_at::text, ', ')
    into buddy_cap_count, buddy_paths
    from public.captures where user_id = buddy_id and captured_at = a_year_ago;
  select status into rel_status from public.streak_buddies
    where (requester_id = buddy_id and recipient_id = me_id) or (requester_id = me_id and recipient_id = buddy_id);

  raise notice 'DEBUG me_id=% buddy_id=% a_year_ago=% my_cap_count=% my_paths=[%] buddy_cap_count=% buddy_paths=[%] rel_status=%',
    me_id, buddy_id, a_year_ago, my_cap_count, my_paths, buddy_cap_count, buddy_paths, rel_status;

  -- get_buddy_peek reads auth.uid(), which is NULL outside a real request context
  -- (this migration runs with no JWT set) -- simulate chocopndn's session, same
  -- pattern this project's own pgTAP suite uses, so the call actually exercises
  -- the real auth.uid()-scoped joins instead of matching nothing.
  perform set_config('request.jwt.claim.sub', me_id::text, true);
  select jsonb_agg(row_to_json(r)) into peek_result from get_buddy_peek(current_date) r;
  raise notice 'DEBUG get_buddy_peek raw result: %', coalesce(peek_result, '[]'::jsonb);
end $$;
