-- supabase/tests/0013_streak_buddies.test.sql
begin;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'erin@example.com'),
  ('66666666-6666-6666-6666-666666666666', 'frank@example.com'),
  ('77777777-7777-7777-7777-777777777777', 'grace@example.com'),
  ('88888888-8888-8888-8888-888888888888', 'henry@example.com');

update public.profiles set username = 'alice' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set username = 'bob' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set username = 'carol' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set username = 'dave' where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set username = 'erin' where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set username = 'frank' where id = '66666666-6666-6666-6666-666666666666';
update public.profiles set username = 'grace' where id = '77777777-7777-7777-7777-777777777777';
update public.profiles set username = 'henry' where id = '88888888-8888-8888-8888-888888888888';

-- Alice already has 3 accepted buddies (carol, dave, erin) so cap tests
-- don't need a fourth round trip through send/respond.
insert into public.streak_buddies (requester_id, recipient_id, status) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'accepted');

-- Grace is also already at the 3-buddy cap (via carol, dave, erin) so we
-- can exercise the recipient-side branch of respond_buddy_request's cap
-- check without disturbing alice's cap assertions above.
insert into public.streak_buddies (requester_id, recipient_id, status) values
  ('33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', 'accepted'),
  ('44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', 'accepted'),
  ('55555555-5555-5555-5555-555555555555', '77777777-7777-7777-7777-777777777777', 'accepted');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select is((select count(*) from search_profiles('a')), 0::bigint, 'query under 2 chars returns no rows');
select is((select count(*) from search_profiles('bob')), 1::bigint, 'search finds bob by username');
select is((select relationship from search_profiles('bob')), 'none', 'no relationship before any request');

select throws_ok(
  $$ select send_buddy_request('alice') $$,
  'You can''t add yourself',
  'cannot send a request to your own username'
);
select throws_ok(
  $$ select send_buddy_request('ghost_xyz') $$,
  'No one found with that username',
  'errors when the username does not exist'
);
select throws_ok(
  $$ select send_buddy_request('bob') $$,
  'You already have 3 buddies',
  'cannot send a request when already at the 3-buddy cap'
);

-- Switch to bob (uncapped) to exercise the normal request/accept flow.
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select send_buddy_request('frank');

select is(
  (select status from public.streak_buddies where requester_id = '22222222-2222-2222-2222-222222222222'
    and recipient_id = '66666666-6666-6666-6666-666666666666'),
  'pending',
  'sending a request creates a pending row'
);
select is(
  (select relationship from search_profiles('frank')),
  'pending_sent',
  'requester sees pending_sent for the person they just requested'
);

-- Bob's request to frank is still pending (frank hasn't responded yet),
-- so resending should hit the duplicate-request check.
select throws_ok(
  $$ select send_buddy_request('frank') $$,
  'A request already exists with this person',
  'cannot resend a request while one is already pending'
);

-- Switch to frank (the recipient) to check the mirrored relationship view.
set local "request.jwt.claim.sub" = '66666666-6666-6666-6666-666666666666';
select is(
  (select relationship from search_profiles('bob')),
  'pending_received',
  'recipient sees pending_received for the person who requested them'
);

-- Only the recipient may respond — switch back to alice (not a party to
-- this request) and confirm she's rejected.
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  format(
    'select respond_buddy_request(%L, true)',
    (select id from public.streak_buddies where requester_id = '22222222-2222-2222-2222-222222222222'
      and recipient_id = '66666666-6666-6666-6666-666666666666')
  ),
  'Request not found',
  'a non-recipient cannot respond to a request'
);

set local "request.jwt.claim.sub" = '66666666-6666-6666-6666-666666666666';
select respond_buddy_request(
  (select id from public.streak_buddies where requester_id = '22222222-2222-2222-2222-222222222222'
    and recipient_id = '66666666-6666-6666-6666-666666666666'),
  true
);
select is(
  (select status from public.streak_buddies where requester_id = '22222222-2222-2222-2222-222222222222'
    and recipient_id = '66666666-6666-6666-6666-666666666666'),
  'accepted',
  'recipient accepting sets status to accepted'
);

-- Independent pair (carol -> dave) to exercise decline.
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
select send_buddy_request('dave');

set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
select respond_buddy_request(
  (select id from public.streak_buddies where requester_id = '33333333-3333-3333-3333-333333333333'
    and recipient_id = '44444444-4444-4444-4444-444444444444'),
  false
);
select is(
  (select status from public.streak_buddies where requester_id = '33333333-3333-3333-3333-333333333333'
    and recipient_id = '44444444-4444-4444-4444-444444444444'),
  'declined',
  'recipient declining sets status to declined'
);

-- Henry requests grace, who is already at the 3-buddy cap. This exercises
-- the recipient-side branch of respond_buddy_request's two-sided cap
-- check, which the assertions above never hit.
set local "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';
select send_buddy_request('grace');

set local "request.jwt.claim.sub" = '77777777-7777-7777-7777-777777777777';
select throws_ok(
  format(
    'select respond_buddy_request(%L, true)',
    (select id from public.streak_buddies where requester_id = '88888888-8888-8888-8888-888888888888'
      and recipient_id = '77777777-7777-7777-7777-777777777777')
  ),
  'Buddy cap reached',
  'recipient already at the cap cannot accept a new request'
);

select * from finish();
rollback;
