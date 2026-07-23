-- Return the drop's day_number so the activity viewer's frame prints the real day
-- (it was defaulting to 0 -> "000" on the print rail). Additive to the follow-cap
-- version; same shape plus one field, so an old client just ignores it.
create or replace function public.get_activity(p_before timestamptz default null, p_limit int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      n.*,
      case when n.kind = 'follow'
           then row_number() over (partition by n.kind order by n.created_at desc)
           else 1 end as follow_rank
    from public.notifications n
    where n.user_id = auth.uid()
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  from (
    select
      r0.id,
      r0.kind,
      r0.created_at,
      (r0.seen_at is not null) as seen,
      r0.event_count,
      case when r0.kind = 'follow' and ap.id is not null
           then jsonb_build_object('id', ap.id, 'username', ap.username, 'avatar_url', ap.avatar_url)
           else null end as actor,
      r0.submission_id,
      sub.thumb_path as thumb_path,
      sub.image_path as image_path,
      sd.day_number  as day_number,
      subj.text      as subject
    from ranked r0
    left join public.profiles     ap   on ap.id   = r0.actor_id
    left join public.submissions  sub  on sub.id  = r0.submission_id
    left join public.subject_drops sd  on sd.id   = r0.drop_id
    left join public.subjects     subj on subj.id = sd.prompt_id
    where (r0.kind <> 'follow' or r0.follow_rank <= 20)
      and (p_before is null or r0.created_at < p_before)
    order by r0.created_at desc
    limit least(coalesce(p_limit, 30), 100)
  ) r;
$$;
revoke execute on function public.get_activity(timestamptz, int) from public, anon;
grant  execute on function public.get_activity(timestamptz, int) to authenticated;
