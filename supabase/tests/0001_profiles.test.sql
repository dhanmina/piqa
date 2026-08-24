begin;
select plan(3);

select has_table('public', 'profiles', 'profiles table should exist');
select has_column('public', 'profiles', 'username', 'profiles should have username');
select col_is_pk('public', 'profiles', 'id', 'profiles.id should be primary key');

select * from finish();
rollback;
