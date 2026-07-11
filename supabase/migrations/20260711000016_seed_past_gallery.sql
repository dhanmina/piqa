-- Give the live project a real, browsable PAST gallery so date-paged history
-- (spec §11c) is testable now. The cloud DB only ever got today's seed drop, so
-- there's nothing behind the end card. We synthesize a "yesterday" BETA gallery
-- that REUSES today's already-uploaded storage objects (same paths), so its
-- tiles render real photos instead of blank skeletons. Idempotent.

do $$
declare
  today_drop uuid;
  today_date date;
  ydrop   uuid := md5('piqa-seed-ydrop-1')::uuid;
  yprompt uuid := md5('piqa-seed-prompt-0')::uuid;
begin
  select id, drop_date into today_drop, today_date
  from public.prompt_drops where region = 'BETA'
  order by drop_date desc limit 1;

  if today_drop is null then return; end if;
  if exists (select 1 from public.prompt_drops where id = ydrop) then return; end if;

  insert into public.prompts (id, text, category, used_at)
  values (yprompt, 'The color of morning', 'light', today_date - 1)
  on conflict (id) do nothing;

  insert into public.prompt_drops
    (id, prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (ydrop, yprompt, 'BETA', today_date - 1,
     now() - interval '25 hours', now() - interval '20 hours', now() - interval '16 hours', 'revealed');

  -- 10 gallery entries reusing today's real uploaded objects (shared paths).
  with tsub as (
    select user_id, image_path, thumb_path
    from public.submissions
    where drop_id = today_drop and thumb_path is not null
    order by user_id
    limit 10
  ),
  n as (select *, row_number() over (order by user_id) as rn from tsub)
  insert into public.submissions
    (id, drop_id, user_id, image_path, thumb_path, captured_at, rating, bt_score,
     vote_count, reaction_count, in_gallery, is_potd, quick_draw)
  select
    md5('piqa-seed-ysub-' || n.rn)::uuid, ydrop, n.user_id, n.image_path, n.thumb_path,
    now() - interval '1 day', 1000 + (11 - n.rn) * 20, ((11 - n.rn)::float8) / 12.0,
    22 - n.rn * 2, (n.rn % 3), true, (n.rn = 1), false
  from n
  on conflict (drop_id, user_id) do nothing;

  insert into public.galleries (drop_id, payload)
  select
    ydrop,
    jsonb_build_object(
      'drop_id', ydrop, 'drop_date', today_date - 1, 'prompt', 'The color of morning',
      'photos', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id, 'thumb_path', s.thumb_path, 'image_path', s.image_path,
            'user_id', s.user_id, 'shooter', p.username,
            'hearts', s.vote_count + s.reaction_count,
            'is_potd', s.is_potd, 'bt_score', s.bt_score, 'captured_at', s.captured_at
          )
          order by s.is_potd desc, s.bt_score desc nulls last
        )
        from public.submissions s
        join public.profiles p on p.id = s.user_id
        where s.drop_id = ydrop and s.in_gallery
      ), '[]'::jsonb)
    )
  on conflict (drop_id) do nothing;
end;
$$;
