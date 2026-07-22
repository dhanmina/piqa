-- Hearts = LIKES only (signed reactions), never blind votes.
--
-- A vote is an anonymous pick during blind judging; a heart is a signed like
-- given after the reveal. The displayed "hearts" number folded the two together
-- (vote_count + reaction_count), so a photo that won lots of matchups showed a
-- big like count with zero real likes. reaction_count already tracks signed
-- hearts live (see 20260711000015_reaction_count); vote_count stays the RANKING
-- signal (frozen at close) and keeps deciding order / PotD — it just never shows
-- as a heart anymore.
--
-- Grants/ownership are preserved by CREATE OR REPLACE, so no re-grant needed.

-- 1) The choke point. Every photo-array display (get_gallery, get_following_gallery,
--    get_profile wins, admin gallery) passes through decorate_photos, which already
--    left-joins submissions. Overriding 'hearts' here fixes all of them AND corrects
--    already-materialized galleries on read (the baked value folded in votes).
CREATE OR REPLACE FUNCTION public.decorate_photos(p_photos jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(
           t.ph || jsonb_build_object(
             'frame_id',   public.photo_frame(pd.drop_date),
             'day_number', pd.day_number,
             'status',     public.photo_status(s.is_potd, s.gallery_rank),
             -- Likes only. Recomputed live so it never inherits the materialized
             -- value (which summed in votes). Falls back to the baked value only
             -- if the submission row is gone.
             'hearts',     coalesce(s.reaction_count, (t.ph ->> 'hearts')::int, 0)
           )
           order by t.ord
         ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) with ordinality as t(ph, ord)
  left join public.submissions   s  on s.id  = (t.ph ->> 'id')::uuid
  left join public.subject_drops  pd on pd.id = s.drop_id;
$function$
;

-- 2) Profile lifetime "hearts" total — reactions only.
CREATE OR REPLACE FUNCTION public.get_profile(p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  target uuid;
  prof public.profiles%rowtype;
  st public.streaks%rowtype;
  galleries int;
  crowns int;
  hearts int;
  wins jsonb;
  owned jsonb;
  badges jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  target := coalesce(p_user, me);

  select * into prof from public.profiles where id = target;
  if prof.id is null then
    return jsonb_build_object('found', false);
  end if;

  select * into st from public.streaks where user_id = target;
  select count(*) into galleries from public.submissions where user_id = target and in_gallery;
  select count(*) into crowns   from public.submissions where user_id = target and is_potd;
  -- Likes only (was vote_count + reaction_count).
  select coalesce(sum(reaction_count), 0) into hearts
    from public.submissions where user_id = target;

  select coalesce(jsonb_agg(
           jsonb_build_object('id', id, 'thumb_path', thumb_path, 'image_path', image_path,
                              'is_potd', is_potd, 'user_id', target, 'drop_date', dd)
           order by dd desc
         ), '[]'::jsonb)
    into wins
  from (
    select s.id, s.thumb_path, s.image_path, s.is_potd, pd.drop_date as dd
    from public.submissions s
    join public.subject_drops pd on pd.id = s.drop_id
    where s.user_id = target and s.in_gallery
    order by pd.drop_date desc
    limit 24
  ) w;

  -- Only the viewer's own unlocks — you never see what frames someone else owns,
  -- just the one they have equipped.
  select coalesce(jsonb_agg(frame_id), '[]'::jsonb) into owned
  from public.user_frames where user_id = me;

  -- User badges (empty array if none).
  select coalesce(jsonb_agg(ub.badge_type order by ub.earned_at), '[]'::jsonb) into badges
  from public.user_badges ub
  where ub.user_id = target;

  return jsonb_build_object(
    'found', true,
    'id', target,
    'username', prof.username,
    'avatar_url', prof.avatar_url,
    'xp', prof.xp,
    'galleries', galleries,
    'streak_weeks', coalesce(st.current_weeks, 0),
    'hearts', hearts,
    'crowns', crowns,
    'wins', public.decorate_photos(public.filter_public_photos(wins, me)),
    'equipped_frame', prof.equipped_frame,
    'owned_frames', owned,
    'badges', badges,
    'is_self', target = me,
    'is_following', exists (select 1 from public.follows where follower_id = me and followee_id = target)
  );
end;
$function$
;

-- 3) User search "hearts" total — reactions only.
create or replace function public.search_users(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  safe_q text;
  res jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if length(trim(p_query)) < 2 then
    return '[]'::jsonb;
  end if;

  safe_q := '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%';

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', p.id,
             'username', p.username,
             'avatar_url', p.avatar_url,
             'is_following', exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.id),
             'followers', coalesce((select count(*) from public.follows f where f.followee_id = p.id), 0),
             -- Likes only (was sum(vote_count + reaction_count)).
             'hearts', coalesce((select sum(s.reaction_count) from public.submissions s where s.user_id = p.id), 0)
           )
         ), '[]'::jsonb)
    into res
  from (
    select id, username, avatar_url
    from public.profiles
    where username ilike safe_q
    limit 20
  ) p;

  return res;
end;
$$;

-- 4) Home state — the PotD heart (shown under a heart glyph), the top-10 list, and
--    the personal result card. Hearts become reactions only; the result card also
--    gets an explicit `votes` field so Today can still say "Picked N times by
--    curators" for a non-gallery shot (its reaction_count is 0 — nobody could see
--    it to like it — so the meaningful signal there is the blind picks it earned).
CREATE OR REPLACE FUNCTION public.get_home_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  top_10_json jsonb := null;
  streak_json jsonb := null;
  result_json jsonb := null;
  top_drop uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  -- Current live drop (between drop and voting close)
  select pd.id, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at, pd.day_number,
         p.text as prompt, p.category as category
    into cur
  from public.subject_drops pd
  join public.subjects p on p.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  -- Next scheduled drop
  select pd.drops_at into nxt
  from public.subject_drops pd
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

  -- Yesterday's POTD: only from revealed drops where a POTD was crowned
  -- (< 3 submissions = no voting = no crown = null here).
  select s2.id, s2.drop_id, s2.thumb_path, s2.is_potd, s2.gallery_rank,
         pd2.day_number,
         s2.reaction_count as hearts,
         pr.username as shooter, pr.equipped_frame as frame
    into potd
  from public.submissions s2
  join public.subject_drops pd2 on pd2.id = s2.drop_id
  join public.profiles pr on pr.id = s2.user_id
  where pd2.region = prof.region
    and pd2.status = 'revealed'
    and s2.is_potd = true
  order by pd2.drop_date desc
  limit 1;

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

  -- Top 10: when no POTD crowned (< 3 submissions, no votes), return the
  -- top 10 submissions from the most recent drop with submissions. Ordering is
  -- still by votes (the ranking signal); only the shown heart count is likes.
  if potd.id is null then
    if cur.id is not null then
      top_drop := cur.id;
    else
      select pd3.id into top_drop
      from public.subject_drops pd3
      where pd3.region = prof.region and pd3.status = 'revealed'
      order by pd3.drop_date desc limit 1;
    end if;

    if top_drop is not null then
      select coalesce(jsonb_agg(t order by t.rnk), '[]'::jsonb)
        into top_10_json
      from (
        select jsonb_build_object(
                 'submission_id', s3.id,
                 'thumb_path', s3.thumb_path,
                 'hearts', s3.reaction_count,
                 'shooter', pr2.username,
                 'equipped_frame', pr2.equipped_frame,
                 'rank', row_number() over (order by s3.vote_count desc, s3.created_at asc)
               ) as t,
               row_number() over (order by s3.vote_count desc, s3.created_at asc) as rnk
        from public.submissions s3
        join public.profiles pr2 on pr2.id = s3.user_id
        where s3.drop_id = top_drop and s3.thumb_path is not null
        order by s3.vote_count desc, s3.created_at asc
        limit 10
      ) q;
    end if;
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
  select pd4.id as drop_id, pd4.drop_date, pd4.day_number
    into latest_rev
  from public.subject_drops pd4
  where pd4.region = prof.region and pd4.status = 'revealed'
  order by pd4.drop_date desc
  limit 1;

  if latest_rev.drop_id is not null then
    select sub.thumb_path, sub.image_path,
           sub.vote_count as votes,
           sub.reaction_count as hearts,
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
        'votes', res.votes,
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
    'top_10', top_10_json,
    'streak', streak_json,
    'xp', prof.xp,
    'equipped_frame', prof.equipped_frame,
    'last_result', result_json
  );
end;
$function$
;
