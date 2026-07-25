-- Track photo views for the "seen by X" social proof on results.
create table if not exists public.photo_views (
  submission_id uuid not null references public.submissions(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (submission_id, viewer_id)
);

alter table public.photo_views enable row level security;

create policy "Viewers insert their own views"
  on public.photo_views for insert
  with check (viewer_id = auth.uid());

create policy "Submissions owner can read views"
  on public.photo_views for select
  using (
    exists (
      select 1 from public.submissions s
      where s.id = photo_views.submission_id and s.user_id = auth.uid()
    )
  );

-- Increment view count for a submission (idempotent per viewer).
create or replace function public.track_photo_view(p_submission_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.photo_views (submission_id, viewer_id)
  values (p_submission_id, auth.uid())
  on conflict (submission_id, viewer_id) do nothing;
$$;

grant execute on function public.track_photo_view(uuid) to authenticated;

-- Get view count for a submission (owner only).
create or replace function public.get_photo_view_count(p_submission_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.photo_views
  where submission_id = p_submission_id
    and exists (
      select 1 from public.submissions s
      where s.id = p_submission_id and s.user_id = auth.uid()
    )
$$;

grant execute on function public.get_photo_view_count(uuid) to authenticated;
