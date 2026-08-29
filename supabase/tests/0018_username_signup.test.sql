begin;
select plan(6);

-- format constraint, exercised through the real signup trigger
select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), 'bad1@example.com', '{"username": "Bad Name!"}'::jsonb) $$,
  '23514',
  null,
  'uppercase/space/punctuation should violate username_format check'
);

select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), 'bad2@example.com', '{"username": "ab"}'::jsonb) $$,
  '23514',
  null,
  'usernames shorter than 3 chars should violate username_format check'
);

select lives_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), 'good@example.com', '{"username": "dhan_99"}'::jsonb) $$,
  'a lowercase alnum/underscore username should be accepted'
);

-- handle_new_user honors a username passed via raw_user_meta_data
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'chosen@example.com', '{"username": "chosenname"}'::jsonb);

select results_eq(
  $$ select username from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('chosenname'::text) $$,
  'handle_new_user should use the username supplied in raw_user_meta_data'
);

-- handle_new_user falls back to a generated slug that still satisfies the format constraint
insert into auth.users (id, email)
values ('22222222-2222-2222-2222-222222222222', 'nouser@example.com');

select matches(
  (select username from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '^[a-z0-9_]{3,20}$',
  'the fallback-generated username should satisfy username_format'
);

-- is_username_available RPC, callable as anon (pre-signup)
select is(
  (select public.is_username_available('dhan_99')),
  false,
  'is_username_available should report a taken username as unavailable'
);

select * from finish();
rollback;
