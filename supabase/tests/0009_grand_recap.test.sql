begin;
select plan(1);

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'grand@example.com');
insert into public.captures (user_id, storage_path, captured_at)
  values ('66666666-6666-6666-6666-666666666666', 'y1.jpg', current_date - 100);

set local role authenticated;
set local "request.jwt.claim.sub" = '66666666-6666-6666-6666-666666666666';

select is((select count(*) from get_grand_recap()), 1::bigint, 'should return captures within the last year');

select * from finish();
rollback;
