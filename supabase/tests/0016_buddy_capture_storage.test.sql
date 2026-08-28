-- supabase/tests/0016_buddy_capture_storage.test.sql
begin;
select plan(3);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice4@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob4@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol4@example.com');

-- Alice and bob are accepted buddies. Carol is a non-buddy.
insert into public.streak_buddies (requester_id, recipient_id, status) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted');

-- Bob has a capture from today and one from yesterday.
insert into public.captures (id, user_id, storage_path, captured_at) values
  ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/today.jpg', current_date),
  ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/yesterday.jpg', current_date - 1);

-- Matching storage.objects rows for both captures (minimal columns: id
-- has a default, bucket_id/name are the ones the RLS policy reads).
insert into storage.objects (id, bucket_id, name) values
  (gen_random_uuid(), 'captures', '22222222-2222-2222-2222-222222222222/today.jpg'),
  (gen_random_uuid(), 'captures', '22222222-2222-2222-2222-222222222222/yesterday.jpg');

set local role authenticated;

-- Alice (accepted buddy) can see bob's today object but not his
-- yesterday object -- the archive privacy boundary holds.
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*) from storage.objects where name = '22222222-2222-2222-2222-222222222222/today.jpg'),
  1::bigint,
  'an accepted buddy can see the owner''s today capture object'
);
select is(
  (select count(*) from storage.objects where name = '22222222-2222-2222-2222-222222222222/yesterday.jpg'),
  0::bigint,
  'an accepted buddy cannot see the owner''s non-today capture object'
);

-- Carol (non-buddy) cannot see bob's today object.
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
select is(
  (select count(*) from storage.objects where name = '22222222-2222-2222-2222-222222222222/today.jpg'),
  0::bigint,
  'a non-buddy cannot see the owner''s today capture object'
);

select * from finish();
rollback;
