begin;
select plan(2);

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

select * from finish();
rollback;
