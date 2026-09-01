-- supabase/tests/0026_avatar_storage.test.sql
begin;
select plan(3);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice5@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob5@example.com');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '11111111-1111-1111-1111-111111111111/avatar.jpg') $$,
  'a user can upload into their own avatars folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '22222222-2222-2222-2222-222222222222/avatar.jpg') $$,
  'new row violates row-level security policy for table "objects"',
  'a user cannot upload into another user''s avatars folder'
);

select lives_ok(
  $$ update storage.objects set name = '11111111-1111-1111-1111-111111111111/avatar.jpg' where name = '11111111-1111-1111-1111-111111111111/avatar.jpg' $$,
  'a user can overwrite their own avatar object'
);

select * from finish();
rollback;
