begin;
select plan(3);

insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'tl2@example.com');
insert into public.captures (user_id, storage_path, captured_at)
  values ('55555555-5555-5555-5555-555555555555', 'd1.jpg', '2026-01-01');
insert into public.frozen_dates (user_id, date) values ('55555555-5555-5555-5555-555555555555', '2026-01-02');

set local role authenticated;
set local "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';

select is(
  (select count(*) from get_timeline_month(2026, 1)),
  31::bigint,
  'january should return 31 day rows'
);

select is(
  (select storage_path from get_timeline_month(2026, 1) where day = 1),
  'd1.jpg',
  'day 1 should carry its capture storage_path'
);

select is(
  (select frozen from get_timeline_month(2026, 1) where day = 2),
  true,
  'day 2 should be marked frozen'
);

select * from finish();
rollback;
