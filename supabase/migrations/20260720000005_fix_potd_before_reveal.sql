-- Fix: only show Photo of the Day from revealed drops in get_home_state.
-- Previously the POTD query didn't filter by drop status, so a manually
-- closed or early-revealed drop could leak the crown before voting ended.

create or replace function public.get_home_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  cur record;
  nxt timestamptz;
  s record;
  potd record;
  st public.streaks%rowtype;
  latest_rev record;
  res record;
  drop_json jsonb := null;
  sub_json jsonb := null;
  potd_json jsonb := null;
  streak_json jsonb := null;
  result_json jsonb := null;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  -- Current live drop (between drop and voting close)
  select pd.id, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at, pd.day_number,
         p.text as prompt, p.category as category
    into cur
  from public.prompt_drops pd
  join public.prompts p on p.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  -- Next scheduled drop
  select pd.drops_at into nxt
  from public.prompt_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  if cur.id is not null then
    drop_json := jsonb_build_object(
      'id', cur.id,
      'prompt', cur.prompt,
      'category', cur.category,
      'drops_at', cur.drops_at,
      'submit_closes_at', cur.submit_closes_at,
      'voting_closes_at', cur.voting_closes_at,
      'day_number', cur.day_number,
      'is_live', (now() < cur.submit_closes_at)
    );

    select sub.id, sub.captured_at, sub.image_path, sub.thumb_path,
           sub.vote_count, sub.reaction_count, sub.quick_draw, sub.in_gallery,
           sub.is_potd, sub.gallery_rank
      into s
    from public.submissions sub
    where sub.drop_id = cur.id and sub.user_id = uid;

    if s.id is not null then
      sub_json := jsonb_build_object(
        'id', s.id,
        'captured_at', s.captured_at,
        'image_path', s.image_path,
        'thumb_path', s.thumb_path,
        'vote_count', s.vote_count,
        'reaction_count', s.reaction_count,
        'quick_draw', s.quick_draw,
        'in_gallery', s.in_gallery,
        'is_potd', s.is_potd,
        'status', public.photo_status(s.is_potd, s.gallery_rank),
        'day_number', cur.day_number
      );
    end if;
  end if;

  -- Yesterday's POTD: only from revealed drops (voting must have ended)
  select s2.id, s2.drop_id, s2.thumb_path, s2.is_potd, s2.gallery_rank,
         pd2.day_number,
         (s2.vote_count + s2.reaction_count) as hearts,
         pr.username as shooter, pr.equipped_frame as frame
    into potd
  from public.submissions s2
  join public.prompt_drops pd2 on pd2.id = s2.drop_id
  join public.profiles pr on pr.id = s2.user_id
  where pd2.region = prof.region
    and pd2.status = 'revealed'
    and s2.is_potd = true
  order by pd2.drop_date desc
  limit 1;

  -- Fallback: if no crowned photo yet, show the top-voted photo from the
  -- most recent revealed drop (seed state / early beta)
  if potd.id is null then
    select s3.id, s3.drop_id, s3.thumb_path, s3.is_potd, s3.gallery_rank,
           pd3.day_number,
           (s3.vote_count + s3.reaction_count) as hearts,
           pr.username as shooter, pr.equipped_frame as frame
      into potd
    from public.submissions s3
    join public.prompt_drops pd3 on pd3.id = s3.drop_id
    join public.profiles pr on pr.id = s3.user_id
    where pd3.region = prof.region
      and pd3.status = 'revealed'
    order by pd3.drop_date desc, s3.vote_count desc
    limit 1;
  end if;

  if potd.id is not null then
    potd_json := jsonb_build_object(
      'submission_id', potd.id,
      'drop_id', potd.drop_id,
      'thumb_path', potd.thumb_path,
      'hearts', potd.hearts,
      'shooter', potd.shooter,
      'equipped_frame', potd.frame,
      'day_number', potd.day_number,
      'status', public.photo_status(potd.is_potd, potd.gallery_rank)
    );
  end if;

  select * into st from public.streaks where user_id = uid;
  if st.user_id is not null then
    streak_json := jsonb_build_object(
      'current_weeks', st.current_weeks,
      'days_this_week', st.days_this_week,
      'shields', st.shields,
      'is_alive', st.is_alive
    );
  end if;

  -- Latest revealed drop for the user's result
  select pd.id as drop_id, pd.drop_date, pd.day_number
    into latest_rev
  from public.prompt_drops pd
  where pd.region = prof.region and pd.status = 'revealed'
  order by pd.drop_date desc
  limit 1;

  if latest_rev.drop_id is not null then
    select sub.thumb_path, sub.image_path,
           (sub.vote_count + sub.reaction_count) as hearts,
           sub.in_gallery, sub.is_potd, sub.gallery_rank, sub.xp_awarded
      into res
    from public.submissions sub
    where sub.drop_id = latest_rev.drop_id and sub.user_id = uid and sub.thumb_path is not null;

    if res.thumb_path is not null then
      result_json := jsonb_build_object(
        'drop_id', latest_rev.drop_id,
        'drop_date', latest_rev.drop_date,
        'day_number', latest_rev.day_number,
        'thumb_path', res.thumb_path,
        'hearts', res.hearts,
        'in_gallery', res.in_gallery,
        'is_potd', res.is_potd,
        'status', public.photo_status(res.is_potd, res.gallery_rank),
        'xp_awarded', res.xp_awarded
      );
    end if;
  end if;

  return jsonb_build_object(
    'drop', drop_json,
    'next_drop_at', nxt,
    'submission', sub_json,
    'yesterday_potd', potd_json,
    'streak', streak_json,
    'xp', prof.xp,
    'equipped_frame', prof.equipped_frame,
    'last_result', result_json
  );
end;
$$;

revoke execute on function public.get_home_state() from public, anon;
grant execute on function public.get_home_state() to authenticated;
