-- supabase/tests/0015_get_buddies.test.sql
begin;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice3@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob3@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol3@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave3@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'erin3@example.com'),
  ('66666666-6666-6666-6666-666666666666', 'frank3@example.com');

update public.profiles set username = 'frank2' where id = '66666666-6666-6666-6666-666666666666';

-- Alice is accepted-buddies with bob (captured today), carol (frozen
-- today), dave (streak but nothing today = at risk), erin (no streak,
-- nothing today). Frank has only sent alice a pending request.
insert into public.streak_buddies (requester_id, recipient_id, status) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'accepted'),
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'pending');

insert into public.captures (id, user_id, storage_path, captured_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'bob-today.jpg', current_date);

insert into public.frozen_dates (user_id, date) values
  ('33333333-3333-3333-3333-333333333333', current_date);

update public.streaks set current_count = 4 where user_id = '44444444-4444-4444-4444-444444444444';
-- erin keeps the default current_count = 0 from the signup trigger.

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select is((select count(*) from get_buddies()), 4::bigint, 'only the 4 accepted buddies are returned, not the pending one');
select is((select status from get_buddies() where buddy_id = '22222222-2222-2222-2222-222222222222'), 'captured_today', 'bob shows captured_today');
select is((select status from get_buddies() where buddy_id = '33333333-3333-3333-3333-333333333333'), 'frozen_today', 'carol shows frozen_today');
select is((select status from get_buddies() where buddy_id = '44444444-4444-4444-4444-444444444444'), 'at_risk', 'dave shows at_risk');
select is((select status from get_buddies() where buddy_id = '55555555-5555-5555-5555-555555555555'), 'none', 'erin shows none');
select is((select reacted_by_me from get_buddies() where buddy_id = '22222222-2222-2222-2222-222222222222'), false, 'reacted_by_me is false before reacting');

select react_to_capture('bbbbbbbb-0000-0000-0000-000000000001');
select is((select reacted_by_me from get_buddies() where buddy_id = '22222222-2222-2222-2222-222222222222'), true, 'reacted_by_me is true after reacting');

select is((select count(*) from get_pending_requests()), 1::bigint, 'one incoming pending request');
select is((select username from get_pending_requests()), 'frank2', 'the pending request is from frank2');

select * from finish();
rollback;
