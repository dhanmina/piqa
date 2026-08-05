-- Bounded angle-hints: up to 3 alternate framings of the same Subject,
-- shown to everyone at drop time so no single literal interpretation
-- blocks a Photographer who doesn't have that exact object/weather/light
-- today. Same table, same pool, same blind vote — presentation only.
--
-- Note: the plan this migration implements was drafted against the
-- pre-rename schema (public.prompts / public.prompt_drops). Those tables
-- were renamed to public.subjects / public.subject_drops in
-- 20260721000002_rename_subjects.sql, so this migration targets the
-- current names throughout.

alter table public.subjects
  add column if not exists angles text[]
  constraint subjects_angles_max_three check (angles is null or array_length(angles, 1) <= 3);

create or replace function public.admin_set_subject_angles(p_subject uuid, p_angles text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text[];
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  -- Drop blanks, cap at 3 (belt and suspenders alongside the CHECK).
  -- The LIMIT has to sit on its own subquery: array_agg() with no GROUP BY
  -- collapses to a single row, so a LIMIT after the aggregate is a no-op on
  -- that one row and would let more than 3 values through into the CHECK.
  select array_agg(a) into cleaned
  from (
    select a
    from (
      select nullif(btrim(x), '') as a
      from unnest(coalesce(p_angles, '{}'::text[])) as x
    ) t
    where a is not null
    limit 3
  ) capped;

  update public.subjects set angles = cleaned where id = p_subject;
end;
$$;
revoke execute on function public.admin_set_subject_angles(uuid, text[]) from public, anon;
grant  execute on function public.admin_set_subject_angles(uuid, text[]) to authenticated;

-- Extend get_home_state() to return the current drop's angle hints.
-- Re-created in full from its latest definition (20260723000001_fix_home_state_top10.sql)
-- so every other field — including the top_10 fallback and latest_rev-derived
-- last_result, both of which the plan's excerpt omitted — stays byte-identical.
-- The only change from that body is: 'angles' added to the `cur` select list
-- and to `drop_json`.
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
         p.text as prompt, p.category as category, p.angles as angles
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
      'angles', to_jsonb(cur.angles),
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
      select coalesce(jsonb_agg(t order by rnk), '[]'::jsonb)
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
