-- supabase/tests/0033_buddy_removal.test.sql
begin;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice33@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob33@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol33@example.com');

update public.profiles set username = 'alice33' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set username = 'bob33' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set username = 'carol33' where id = '33333333-3333-3333-3333-333333333333';

insert into public.streak_buddies (requester_id, recipient_id, status) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'pending');

set local role authenticated;

-- cancel_buddy_request: only the requester of a pending row may cancel it.
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  format(
    'select cancel_buddy_request(%L)',
    (select id from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
      and recipient_id = '33333333-3333-3333-3333-333333333333')
  ),
  'Request not found',
  'the recipient cannot cancel a request sent to them'
);

set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select cancel_buddy_request(
  (select id from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
    and recipient_id = '33333333-3333-3333-3333-333333333333')
);
select is(
  (select status from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
    and recipient_id = '33333333-3333-3333-3333-333333333333'),
  'cancelled',
  'the requester cancelling sets status to cancelled'
);

-- A cancelled pair is no longer blocked by the pending/accepted unique index.
select send_buddy_request('carol33');
select is(
  (select status from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
    and recipient_id = '33333333-3333-3333-3333-333333333333' and status = 'pending'),
  'pending',
  'a cancelled pair can be re-requested'
);

select throws_ok(
  format('select cancel_buddy_request(%L)', gen_random_uuid()),
  'Request not found',
  'cancelling a nonexistent request errors'
);

-- remove_buddy: only a participant of an accepted row may remove it.
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  format(
    'select remove_buddy(%L)',
    (select id from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
      and recipient_id = '22222222-2222-2222-2222-222222222222')
  ),
  'Buddy not found',
  'a non-participant cannot remove a buddy relationship'
);

-- The recipient side (not just the requester) may remove an accepted buddy.
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select remove_buddy(
  (select id from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
    and recipient_id = '22222222-2222-2222-2222-222222222222')
);
select is(
  (select status from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
    and recipient_id = '22222222-2222-2222-2222-222222222222'),
  'removed',
  'the recipient removing an accepted buddy sets status to removed'
);

select throws_ok(
  format(
    'select remove_buddy(%L)',
    (select id from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
      and recipient_id = '22222222-2222-2222-2222-222222222222')
  ),
  'Buddy not found',
  'removing an already-removed relationship errors instead of re-applying'
);

-- A removed pair is no longer blocked by the pending/accepted unique index.
-- Back to alice: she was the original requester in the now-removed pair.
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select send_buddy_request('bob33');
select is(
  (select status from public.streak_buddies where requester_id = '11111111-1111-1111-1111-111111111111'
    and recipient_id = '22222222-2222-2222-2222-222222222222' and status = 'pending'),
  'pending',
  'a removed pair can be re-requested'
);

select * from finish();
rollback;
