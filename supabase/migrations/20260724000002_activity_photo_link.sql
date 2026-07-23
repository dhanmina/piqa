-- Deep-link activity rows to the shot itself. get_activity now also returns the
-- submission id + full-res image_path, so tapping an appreciation / win / potd row
-- opens that exact photo (PhotoDetailView), not just the gallery cover. Follow
-- rows still carry the actor and route to the follower's profile. Additive to
-- 20260724000001 — same shape plus two fields, so an old client just ignores them.
create or replace function public.get_activity(p_before timestamptz default null, p_limit int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  from (
    select
      n.id,
      n.kind,
      n.created_at,
      (n.seen_at is not null) as seen,
      n.event_count,
      case when n.kind = 'follow' and ap.id is not null
           then jsonb_build_object('id', ap.id, 'username', ap.username, 'avatar_url', ap.avatar_url)
           else null end as actor,
      n.submission_id,
      sub.thumb_path as thumb_path,
      sub.image_path as image_path,
      subj.text      as subject
    from public.notifications n
    left join public.profiles     ap   on ap.id   = n.actor_id
    left join public.submissions  sub  on sub.id  = n.submission_id
    left join public.subject_drops sd  on sd.id   = n.drop_id
    left join public.subjects     subj on subj.id = sd.prompt_id
    where n.user_id = auth.uid()
      and (p_before is null or n.created_at < p_before)
    order by n.created_at desc
    limit least(coalesce(p_limit, 30), 100)
  ) r;
$$;
revoke execute on function public.get_activity(timestamptz, int) from public, anon;
grant  execute on function public.get_activity(timestamptz, int) to authenticated;
