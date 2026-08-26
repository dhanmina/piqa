begin;
select plan(2);

select has_column('public', 'profiles', 'onboarded_at', 'profiles should have onboarded_at');
select col_type_is('public', 'profiles', 'onboarded_at', 'timestamp with time zone', 'onboarded_at should be timestamptz');

select * from finish();
rollback;
