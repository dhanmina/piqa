begin;
select plan(2);

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'recap@example.com');
insert into public.captures (user_id, storage_path, captured_at)
  values ('66666666-6666-6666-6666-666666666666', 'today.jpg', current_date);
insert into public.captures (user_id, storage_path, captured_at)
  values ('66666666-6666-6666-6666-666666666666', 'toolold.jpg', current_date - 8);

set local role authenticated;
set local "request.jwt.claim.sub" = '66666666-6666-6666-6666-666666666666';

select is((select count(*) from get_weekly_recap()), 1::bigint, 'should return only captures from the last 7 days');
select is((select storage_path from get_weekly_recap()), 'today.jpg', 'should exclude captures older than 7 days');

select * from finish();
rollback;
