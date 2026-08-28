begin;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice2@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob2@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol2@example.com');

insert into public.streak_buddies (requester_id, recipient_id, status) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted');

insert into public.captures (id, user_id, storage_path, captured_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'today.jpg', current_date),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'yesterday.jpg', current_date - 1);

set local role authenticated;

-- Carol is not bob's buddy.
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  $$ select react_to_capture('aaaaaaaa-0000-0000-0000-000000000001') $$,
  'Not an accepted buddy',
  'a non-buddy cannot react to a capture'
);

set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select react_to_capture('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select count(*) from public.reactions where capture_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and reactor_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'reacting inserts one row'
);

select react_to_capture('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select count(*) from public.reactions where capture_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and reactor_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'reacting a second time stays idempotent, no duplicate row'
);

select throws_ok(
  $$ select react_to_capture('aaaaaaaa-0000-0000-0000-000000000002') $$,
  'Can only react to today''s capture',
  'cannot react to a capture that is not from today'
);

select throws_ok(
  $$ select react_to_capture('99999999-9999-9999-9999-999999999999') $$,
  'Capture not found',
  'errors when the capture id does not exist'
);

select * from finish();
rollback;
