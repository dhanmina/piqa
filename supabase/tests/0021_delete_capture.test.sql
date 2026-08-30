begin;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'delowner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'delattacker@example.com');

-- Ascending insert order matters -- record_capture_streak (0003_streaks.sql)
-- builds current_count off the previously stored last_capture_date on each insert.
insert into public.captures (id, user_id, storage_path, captured_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'old.jpg', current_date - 2);
insert into public.captures (id, user_id, storage_path, captured_at) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'mid.jpg', current_date - 1);
insert into public.captures (id, user_id, storage_path, captured_at) values
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'today-a.jpg', current_date);
insert into public.captures (id, user_id, storage_path, captured_at) values
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'today-b.jpg', current_date);
-- current_count is now 3 (old -> mid -> today), last_capture_date = current_date.

set local role authenticated;

set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  $$ select delete_capture('99999999-9999-9999-9999-999999999999') $$,
  'Capture not found',
  'errors when the capture id does not exist'
);

set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select throws_ok(
  $$ select delete_capture('aaaaaaaa-0000-0000-0000-000000000001') $$,
  'Capture not found',
  'a non-owner cannot delete another user''s capture'
);

set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select delete_capture('aaaaaaaa-0000-0000-0000-000000000004');
select is(
  (select current_count from public.streaks where user_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'deleting one of two same-day captures leaves current_count untouched'
);

select delete_capture('aaaaaaaa-0000-0000-0000-000000000003');
select is(
  (select current_count from public.streaks where user_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'deleting the day''s last remaining capture on the streak front rolls current_count back'
);
select is(
  (select last_capture_date from public.streaks where user_id = '11111111-1111-1111-1111-111111111111'),
  (current_date - 1),
  'last_capture_date rolls back to the prior consecutive day'
);

select is(
  delete_capture('aaaaaaaa-0000-0000-0000-000000000002'),
  'mid.jpg',
  'delete_capture returns the deleted row''s storage_path'
);

select * from finish();
rollback;
