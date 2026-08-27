begin;
select plan(1);

insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'mosaic@example.com');
insert into public.captures (user_id, storage_path, captured_at)
  values ('55555555-5555-5555-5555-555555555555', 'm1.jpg', current_date - 30);

set local role authenticated;
set local "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';

select is((select count(*) from get_profile_mosaic()), 1::bigint, 'should return all-time captures');

select * from finish();
rollback;
