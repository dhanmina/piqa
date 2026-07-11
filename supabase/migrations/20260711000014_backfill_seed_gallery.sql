-- Materialize a galleries blob for any already-revealed drop that has gallery
-- submissions but no blob yet (the seed "yesterday" gallery predates close_day).
-- One-time backfill so past-gallery browsing has a real immutable back-issue to
-- page to. Same payload shape close_day writes.

insert into public.galleries (drop_id, payload)
select
  pd.id,
  jsonb_build_object(
    'drop_id', pd.id,
    'drop_date', pd.drop_date,
    'prompt', pr.text,
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', s.id, 'thumb_path', s.thumb_path, 'image_path', s.image_path,
                 'user_id', s.user_id, 'shooter', p.username,
                 'hearts', s.vote_count + s.reaction_count,
                 'is_potd', s.is_potd, 'bt_score', s.bt_score, 'captured_at', s.captured_at
               )
               order by s.is_potd desc, s.bt_score desc nulls last, s.vote_count desc
             )
      from public.submissions s
      join public.profiles p on p.id = s.user_id
      where s.drop_id = pd.id and s.in_gallery
    ), '[]'::jsonb)
  )
from public.prompt_drops pd
join public.prompts pr on pr.id = pd.prompt_id
where pd.status = 'revealed'
  and exists (select 1 from public.submissions s where s.drop_id = pd.id and s.in_gallery)
  and not exists (select 1 from public.galleries g where g.drop_id = pd.id)
on conflict (drop_id) do nothing;
