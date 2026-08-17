-- get_matchup() is the curation entry point — every vote in the app starts
-- here. This just locks in the one thing that must never regress: it refuses
-- to run for a caller with no session, rather than silently returning an
-- empty/wrong pairing set.
begin;
select plan(1);

select throws_ok(
  $$ select public.get_matchup() $$,
  'not_authenticated',
  'get_matchup() refuses an unauthenticated caller instead of returning empty pairs'
);

select * from finish();
rollback;
