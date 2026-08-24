begin;
select plan(4);

select has_table('public', 'captures', 'captures table should exist');
select has_column('public', 'captures', 'captured_at', 'captures should have captured_at');
select col_type_is('public', 'captures', 'captured_at', 'date', 'captured_at should be date type');
select policies_are('public', 'captures', array['captures_select_own', 'captures_insert_own'], 'captures should have owner-only policies');

select * from finish();
rollback;
