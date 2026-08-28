-- supabase/tests/0017_streak_buddies_pair_unique.test.sql
begin;
select plan(1);

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999991', 'unique1@example.com'),
  ('99999999-9999-9999-9999-999999999992', 'unique2@example.com');

insert into public.streak_buddies (requester_id, recipient_id, status) values
  ('99999999-9999-9999-9999-999999999991', '99999999-9999-9999-9999-999999999992', 'pending');

select throws_ok(
  $$ insert into public.streak_buddies (requester_id, recipient_id, status)
     values ('99999999-9999-9999-9999-999999999992', '99999999-9999-9999-9999-999999999991', 'pending') $$,
  'duplicate key value violates unique constraint "streak_buddies_pair_idx"',
  'the unique index blocks a second pending row for the same pair even with requester/recipient reversed'
);

select * from finish();
rollback;
