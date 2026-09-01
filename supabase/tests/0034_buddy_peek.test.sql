-- supabase/tests/0034_buddy_peek.test.sql
begin;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice34@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob34@example.com');

update public.profiles set username = 'alice34' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set username = 'bob34' where id = '22222222-2222-2222-2222-222222222222';

insert into public.streak_buddies (requester_id, recipient_id, status) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted');

-- Both captured 7 days ago AND 1 month ago -- priority order should still
-- pick the nearer (last week) match, not the month-old one.
insert into public.captures (id, user_id, storage_path, captured_at) values
  ('cccccccc-1111-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111/week.jpg', current_date - 7),
  ('cccccccc-2222-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/week.jpg', current_date - 7),
  ('cccccccc-1111-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111/month.jpg', (current_date - interval '1 month')::date),
  ('cccccccc-2222-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/month.jpg', (current_date - interval '1 month')::date);

-- Bob also has a capture from an arbitrary non-offset day (3 days ago) that
-- alice does NOT share -- must stay invisible/unreactable to her, accepted
-- buddy or not.
insert into public.captures (id, user_id, storage_path, captured_at) values
  ('cccccccc-2222-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/three.jpg', current_date - 3);

insert into storage.objects (id, bucket_id, name) values
  (gen_random_uuid(), 'captures', '22222222-2222-2222-2222-222222222222/week.jpg'),
  (gen_random_uuid(), 'captures', '22222222-2222-2222-2222-222222222222/three.jpg');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select is(
  (select buddy_username from get_buddy_peek()),
  'bob34',
  'get_buddy_peek finds the accepted buddy with a reciprocal capture'
);
select is(
  (select label from get_buddy_peek()),
  'last week',
  'the nearer offset (last week) wins over an also-matching month-old pair'
);

-- Storage visibility: reciprocal date visible, arbitrary non-offset date is not.
select is(
  (select count(*) from storage.objects where name = '22222222-2222-2222-2222-222222222222/week.jpg'),
  1::bigint,
  'a buddy can view the reciprocal Buddy Peek date''s storage object'
);
select is(
  (select count(*) from storage.objects where name = '22222222-2222-2222-2222-222222222222/three.jpg'),
  0::bigint,
  'a buddy cannot view a non-reciprocal, non-today storage object even when accepted'
);

-- react_to_capture: allowed on the reciprocal-match capture, rejected on the arbitrary one.
select lives_ok(
  $$ select react_to_capture('cccccccc-2222-0000-0000-000000000001') $$,
  'reacting to the buddy''s reciprocal Buddy Peek capture succeeds'
);
select is(
  (select count(*) from public.reactions where capture_id = 'cccccccc-2222-0000-0000-000000000001'
    and reactor_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'reacting to the Buddy Peek capture inserts a reaction row'
);
select throws_ok(
  $$ select react_to_capture('cccccccc-2222-0000-0000-000000000003') $$,
  'Can only react to today''s capture or a shared Buddy Peek moment',
  'reacting to a non-reciprocal, non-today capture still throws'
);

select is(
  (select reacted_by_me from get_buddy_peek()),
  true,
  'get_buddy_peek reflects the reaction just made on the buddy''s photo'
);

select * from finish();
rollback;
