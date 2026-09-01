begin;
select plan(4);

insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'peek@example.com');

set local role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';

select is((select count(*) from get_peek_back()), 0::bigint, 'no peek back with zero history');

insert into public.captures (user_id, storage_path, captured_at)
  values ('44444444-4444-4444-4444-444444444444', 'weekago.jpg', current_date - 7);

select is(
  (select label from get_peek_back()),
  'last week',
  'should surface the same-day-last-week capture first'
);

-- Archive fallback (no exact week/month/year match): repeated calls on the same
-- day must return the same photo, not re-roll on every call (was `order by random()`).
insert into public.captures (user_id, storage_path, captured_at) values
  ('44444444-4444-4444-4444-444444444444', 'archive1.jpg', current_date - 40),
  ('44444444-4444-4444-4444-444444444444', 'archive2.jpg', current_date - 41),
  ('44444444-4444-4444-4444-444444444444', 'archive3.jpg', current_date - 42);
delete from public.captures where storage_path = 'weekago.jpg';

select is(
  (select storage_path from get_peek_back()),
  (select storage_path from get_peek_back()),
  'archive fallback should be stable across repeated calls on the same day'
);

select ok(
  (select storage_path from get_peek_back()) in ('archive1.jpg', 'archive2.jpg', 'archive3.jpg'),
  'archive fallback should return one of the eligible photos'
);

select * from finish();
rollback;
