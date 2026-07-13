-- The previous policy (20260713000001) still denied matchup thumbs. Its
-- exists(... from public.submissions ...) subquery runs under the CALLER's RLS,
-- and the submissions read policies only expose your own rows + in_gallery rows.
-- A matchup photo is another user's non-gallery submission, so RLS hid that row
-- inside the policy's own subquery → exists() was always false → access denied.
--
-- Fix: evaluate the check in a SECURITY DEFINER function so it sees all rows
-- (bypasses RLS), and gate the policy on that. Still thumbnails only, still only
-- while the drop is in its live voting window.

create or replace function public.is_live_drop_thumb(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.thumb_path = object_name
      and now() >= pd.drops_at
      and now() < pd.voting_closes_at
  );
$$;

revoke execute on function public.is_live_drop_thumb(text) from public, anon;
grant  execute on function public.is_live_drop_thumb(text) to authenticated;

drop policy if exists "live drop thumbs are readable for curation" on storage.objects;

create policy "live drop thumbs are readable for curation"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and public.is_live_drop_thumb(name)
  );
