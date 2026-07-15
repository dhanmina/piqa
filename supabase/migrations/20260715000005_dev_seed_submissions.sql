-- DEV — seed house-account submissions for the current BETA drop, so curation
-- (get_matchup) has pairs to judge. get_matchup excludes your own photo, so a
-- solo tester never gets a pair; this fills the drop with @joinpiqa.com shots.
--
-- Renderable, not blank: like seed_past_gallery, we REUSE real uploaded storage
-- objects (existing submissions' image_path/thumb_path) rather than inventing
-- paths. Curation can only sign an object that's behind an in_gallery submission
-- (the "gallery submission objects are readable" storage policy), so we prefer
-- reusing in_gallery paths; if none exist yet, we reuse any uploaded path and
-- mark the seeded rows in_gallery so their objects become signable too.
--
-- Idempotent (skips house accounts that already submitted) and beta-guarded.

create or replace function public.dev_seed_submissions(p_count int default 12)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  did uuid;
  mark_gallery boolean;
  pool_cnt int;
  seeded int := 0;
begin
  perform public.dev_guard();

  select id into did
  from public.prompt_drops
  where region = 'BETA' and drop_date = today_local;

  if did is null then
    return jsonb_build_object('ok', false, 'reason', 'no drop — Force drop first');
  end if;

  -- If any signable (in_gallery) object exists, reuse those and leave the seeded
  -- rows out of the gallery; otherwise reuse anything and mark them in_gallery so
  -- their thumbs can be signed during curation.
  select not exists (
    select 1 from public.submissions where thumb_path is not null and in_gallery
  ) into mark_gallery;

  select count(*) into pool_cnt from (
    select distinct image_path, thumb_path
    from public.submissions
    where thumb_path is not null and (mark_gallery or in_gallery)
  ) q;

  if pool_cnt = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no uploaded photos to reuse');
  end if;

  with pool as (
    select image_path, thumb_path, row_number() over (order by thumb_path) as rn
    from (
      select distinct image_path, thumb_path
      from public.submissions
      where thumb_path is not null and (mark_gallery or in_gallery)
    ) d
  ),
  houses as (
    select pr.id as uid, row_number() over (order by pr.id) as hn
    from public.profiles pr
    join auth.users u on u.id = pr.id
    where u.email like '%@joinpiqa.com'
      and not exists (
        select 1 from public.submissions s where s.drop_id = did and s.user_id = pr.id
      )
    order by pr.id
    limit p_count
  )
  insert into public.submissions
    (drop_id, user_id, image_path, thumb_path, captured_at, quick_draw, in_gallery)
  select did, h.uid, p.image_path, p.thumb_path, now(), false, mark_gallery
  from houses h
  join pool p on p.rn = ((h.hn - 1) % pool_cnt) + 1
  on conflict (drop_id, user_id) do nothing;

  get diagnostics seeded = row_count;

  return jsonb_build_object(
    'ok', true,
    'drop_id', did,
    'seeded', seeded,
    'submissions', (select count(*) from public.submissions where drop_id = did and thumb_path is not null)
  );
end;
$$;

revoke execute on function public.dev_seed_submissions(int) from public, anon;
grant  execute on function public.dev_seed_submissions(int) to authenticated, service_role;
