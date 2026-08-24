-- supabase/tests/0003_streaks.test.sql
begin;
select plan(6);

-- seed a user via auth.users insert (trigger now auto-creates a default
-- streaks row too, via handle_new_user() -> no manual streaks insert needed
-- or it would PK-violate)
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');

-- seed a second user up front (while still service_role) for the freeze-bridge
-- continuity test below: last_capture_date a few days in the past, enough
-- freezes_remaining to fully bridge the gap. The signup trigger already
-- created a default streaks row for this user, so overwrite it rather than
-- inserting a fresh one.
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'freeze-test@example.com');
update public.streaks
  set current_count = 5,
      longest_count = 5,
      last_capture_date = current_date - 2,
      freezes_remaining = 2,
      freeze_week_start = current_date - extract(dow from current_date)::int
  where user_id = '22222222-2222-2222-2222-222222222222';

-- a genuinely fresh signup: no manual streaks insert or update at all. This
-- is the actual gap fix #2 guards against; it confirms auto-provisioning, not
-- just that a manually-seeded row happens to exist.
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'fresh-signup@example.com');

select has_function('public', 'get_today_state', 'get_today_state RPC should exist');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select is(
  (select captured_today from get_today_state()),
  false,
  'captured_today should be false with no capture today'
);

insert into public.captures (user_id, storage_path, captured_at)
  values ('11111111-1111-1111-1111-111111111111', 'x.jpg', current_date);

select is(
  (select captured_today from get_today_state()),
  true,
  'captured_today should be true after a capture today'
);

-- same-day recapture should NOT inflate longest_count: current_count stays
-- put (no daily cap on captures, but the streak day itself doesn't advance
-- twice), so longest_count must be derived from the same post-update value,
-- not a separate current_count + 1 expression
insert into public.captures (user_id, storage_path, captured_at)
  values ('11111111-1111-1111-1111-111111111111', 'x2.jpg', current_date);

select results_eq(
  $$ select current_count, longest_count from public.streaks where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values (1, 1) $$,
  'a same-day recapture should not inflate longest_count past current_count'
);

-- a freeze-bridged gap should survive the next real capture: the streak should
-- continue, not silently reset to 1 (regression guard for the last_capture_date
-- not advancing after the freeze-bridging loop in get_today_state())
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

-- gap is 1 missed day (current_date - 1); 2 freezes available should fully bridge it
select get_today_state();

insert into public.captures (user_id, storage_path, captured_at)
  values ('22222222-2222-2222-2222-222222222222', 'y.jpg', current_date);

select is(
  (select current_count from public.streaks where user_id = '22222222-2222-2222-2222-222222222222'),
  6,
  'a real capture after a freeze-bridged gap should continue the streak, not reset to 1'
);

-- a genuinely fresh signup (never manually seeded into streaks) should get
-- the documented 0/0/2 defaults back from get_today_state(), not NULLs
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$ select current_count, longest_count, freezes_remaining, captured_today from get_today_state() $$,
  $$ values (0, 0, 2, false) $$,
  'a fresh signup with no manual streaks seed should get 0/0/2 defaults, not NULLs'
);

select * from finish();
rollback;
