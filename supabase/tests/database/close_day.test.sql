-- close_day() is the riskiest function in the app: a Bradley-Terry MLE fit,
-- a gallery-percentile cutoff, a PotD quorum gate, and a ghost-submission
-- guard (ids must have a real file in storage.objects), all rewritten across
-- ~9 migrations. No existing test covered any of it before this file. Added
-- as Phase 1.5D step 2 (2026-08-17 field report) — a regression net under
-- the math, not full coverage.
begin;
select plan(5);

-- Deterministic config for this test, independent of whatever is live.
insert into public.config (key, value) values
  ('potd_min_votes',          '2'),
  ('quorum',                  '3'),
  ('beta_mode',               'true'),
  ('beta_gallery_all_below',  '15'),
  ('vote_cap',                '50')
on conflict (key) do update set value = excluded.value;

insert into public.subjects (id, text) values
  ('a0000000-0000-0000-0000-000000000001', 'Something red within reach');

-- ---------------------------------------------------------------------------
-- Scenario 1 (drop 1): 3 submitters, only 1 vote cast total — below the
-- potd_min_votes floor. This is the exact bug 20260716000004 fixed: a
-- low-participation day must crown NOBODY, not an arbitrary photo.
-- ---------------------------------------------------------------------------
insert into public.subject_drops
  (id, prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'BETA', current_date, now() - interval '3 hours', now() - interval '2 hours',
   now() - interval '10 minutes', 'closed');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'close-day-a@test.piqa'),
  ('10000000-0000-0000-0000-000000000002', 'close-day-b@test.piqa'),
  ('10000000-0000-0000-0000-000000000003', 'close-day-c@test.piqa');

insert into public.submissions (id, drop_id, user_id, thumb_path, captured_at) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'a.jpg', now()),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', 'b.jpg', now()),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003', 'c.jpg', now());

-- The ghost-submission guard requires a real file behind each thumb_path.
insert into storage.objects (bucket_id, name) values
  ('submissions', 'a.jpg'), ('submissions', 'b.jpg'), ('submissions', 'c.jpg');

-- One vote only (< potd_min_votes = 2).
insert into public.votes (drop_id, voter_id, winner_id, loser_id) values
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003');

select public.close_day('b0000000-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from public.submissions
     where drop_id = 'b0000000-0000-0000-0000-000000000001' and is_potd),
  0,
  'no crown when votes cast are below potd_min_votes'
);

select ok(
  (select bool_and(in_gallery) from public.submissions
     where drop_id = 'b0000000-0000-0000-0000-000000000001'),
  'beta_mode with k below beta_gallery_all_below puts every submission in the gallery'
);

-- Re-closing the same day must not re-award XP (already_closed guard).
select is(
  (public.close_day('b0000000-0000-0000-0000-000000000001') ->> 'awarded_xp')::boolean,
  false,
  'closing an already-closed day does not re-award xp a second time'
);

-- ---------------------------------------------------------------------------
-- Scenario 2 (drop 2): one submitter (D) dominates two others (E, F) head to
-- head, everyone meets quorum. D must rank #1 and take the crown — this is
-- the Bradley-Terry fit actually doing its job, not just returning input order.
-- ---------------------------------------------------------------------------
insert into public.subject_drops
  (id, prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
values
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'BETA-TEST2', current_date, now() - interval '3 hours', now() - interval '2 hours',
   now() - interval '10 minutes', 'closed');

-- D, E, F submit; G, H are curators only (no submission) — kept separate so
-- no vote below can ever be a disallowed self-vote on the voter's own photo.
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000004', 'close-day-d@test.piqa'),
  ('10000000-0000-0000-0000-000000000005', 'close-day-e@test.piqa'),
  ('10000000-0000-0000-0000-000000000006', 'close-day-f@test.piqa'),
  ('10000000-0000-0000-0000-000000000007', 'close-day-g@test.piqa'),
  ('10000000-0000-0000-0000-000000000008', 'close-day-h@test.piqa');

insert into public.submissions (id, drop_id, user_id, thumb_path, captured_at) values
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000004', 'd.jpg', now()),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000005', 'e.jpg', now()),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000006', 'f.jpg', now());

insert into storage.objects (bucket_id, name) values
  ('submissions', 'd.jpg'), ('submissions', 'e.jpg'), ('submissions', 'f.jpg');

-- Curators G and H judge (never their own photo, since they didn't submit).
-- D beats E twice, D beats F twice, E beats F once. D: 4 wins / 4 comparisons.
insert into public.votes (drop_id, voter_id, winner_id, loser_id) values
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007',
   'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008',
   'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007',
   'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008',
   'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007',
   'c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000006');

select public.close_day('b0000000-0000-0000-0000-000000000002');

select is(
  (select gallery_rank from public.submissions where id = 'c0000000-0000-0000-0000-000000000004'),
  1,
  'the submission that won every head-to-head ranks #1 after the Bradley-Terry fit'
);

select ok(
  (select is_potd from public.submissions where id = 'c0000000-0000-0000-0000-000000000004'),
  'the #1-ranked submission (meeting quorum) is crowned Photo of the Day'
);

select * from finish();
rollback;
