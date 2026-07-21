-- Nods received (learning loop · closes the Nods feedback loop): aggregate all the
-- nods a photographer's shots have earned, by tag. Shown on the profile as
-- "What curators notice" — the craft signal a shooter learns from ("people keep
-- noticing my light"). Public, like nod aggregates on photos.
create or replace function public.get_nods_received(p_user uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(z.tag, z.cnt), '{}'::jsonb)
  from (
    select n.tag, count(*) as cnt
    from public.nods n
    join public.submissions s on s.id = n.submission_id
    where s.user_id = coalesce(p_user, auth.uid())
    group by n.tag
  ) z;
$$;
revoke execute on function public.get_nods_received(uuid) from public, anon;
grant  execute on function public.get_nods_received(uuid) to authenticated;
