begin;
select plan(3);

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'mosaic-cap@example.com');

insert into public.captures (user_id, storage_path, captured_at)
select
  '66666666-6666-6666-6666-666666666666',
  'cap-' || i || '.jpg',
  current_date - i
from generate_series(0, 29) as i;

set local role authenticated;
set local "request.jwt.claim.sub" = '66666666-6666-6666-6666-666666666666';

select is(
  (select count(*) from get_profile_mosaic()),
  27::bigint,
  'should cap to the 27 most recent captures even when 30 exist'
);

select is(
  (select storage_path from get_profile_mosaic() limit 1),
  'cap-0.jpg',
  'should return the most recent capture first'
);

select is_empty(
  $$ select storage_path from get_profile_mosaic()
     where storage_path in ('cap-27.jpg', 'cap-28.jpg', 'cap-29.jpg') $$,
  'should exclude the three oldest captures'
);

select * from finish();
rollback;
