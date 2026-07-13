-- Phase 5 · Scale & Performance (Spec: smooth for many users)

-- 1. Enable trigram extension for fast wildcard searches on usernames
create extension if not exists pg_trgm;

-- Create GIN index for search_users (makes `ilike '%text%'` lightning fast)
create index if not exists idx_profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);

-- 2. Foreign Key Indexes
-- Postgres does not automatically index foreign keys. Without these, joins and aggregate counts
-- (like calculating a user's total hearts or followers) will cause full table scans.

-- Follows: crucial for counting followers and generating the Following feed
create index if not exists idx_follows_follower on public.follows(follower_id);
create index if not exists idx_follows_followee on public.follows(followee_id);

-- Submissions: crucial for profile highlight reels and summing total hearts
create index if not exists idx_submissions_user_id on public.submissions(user_id);
create index if not exists idx_submissions_drop_id on public.submissions(drop_id);

-- Reactions: crucial for loading user's heart state in the gallery
create index if not exists idx_reactions_user_id on public.reactions(user_id);
create index if not exists idx_reactions_submission_id on public.reactions(submission_id);

-- Streaks: crucial for the game loop validations
create index if not exists idx_streaks_user_id on public.streaks(user_id);
