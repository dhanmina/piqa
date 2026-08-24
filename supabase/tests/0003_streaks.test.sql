-- supabase/tests/0003_streaks.test.sql
begin;
select plan(4);

-- seed a user via auth.users insert (trigger creates profiles + default streaks row expected)
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test@example.com');
insert into public.streaks (user_id) values ('11111111-1111-1111-1111-111111111111');

-- seed a second user up front (while still service_role) for the freeze-bridge
-- continuity test below: last_capture_date a few days in the past, enough
-- freezes_remaining to fully bridge the gap
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'freeze-test@example.com');
insert into public.streaks (user_id, current_count, longest_count, last_capture_date, freezes_remaining, freeze_week_start)
  values (
    '22222222-2222-2222-2222-222222222222',
    5, 5,
    current_date - 2,
    2,
    current_date - extract(dow from current_date)::int
  );

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

select * from finish();
rollback;
