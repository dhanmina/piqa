-- supabase/migrations/0040_recap_shares.sql
--
-- A recap share is a frozen snapshot: range_start/range_end are computed once
-- at creation time (same -6/-365 day windows as get_weekly_recap/get_grand_recap
-- in 0007_recap.sql/0009_grand_recap.sql) and never re-derived from current_date,
-- so a link shared today doesn't quietly grow to include captures taken after
-- it was shared. No anon/public RLS policy is added on purpose -- the only way
-- an unauthenticated caller can ever read a share is through the get-shared-recap
-- Edge Function, which uses the service-role key to bypass RLS after validating
-- the share itself (not revoked). Keeping this table owner-only avoids leaking
-- user_id or existence of a share id to anyone who isn't the app's own client.
create table public.recap_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('week', 'year')),
  range_start date not null,
  range_end date not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index recap_shares_user_idx on public.recap_shares (user_id);

alter table public.recap_shares enable row level security;

create policy "recap_shares_select_own" on public.recap_shares
  for select using (auth.uid() = user_id);

create policy "recap_shares_insert_own" on public.recap_shares
  for insert with check (auth.uid() = user_id);

create policy "recap_shares_revoke_own" on public.recap_shares
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.recap_shares to authenticated;
