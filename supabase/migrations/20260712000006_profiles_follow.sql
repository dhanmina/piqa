-- Phase 4 · Step 6 — Profiles + follow (spec §9, §11c).
--
-- A profile is a highlight reel: username, avatar, level, streak weeks, gallery
-- count, hearts, crowns, and a wins wall (gallery placements). Since streaks and
-- non-gallery submissions are owner-only under RLS, get_profile is SECURITY
-- DEFINER so it can expose the PUBLIC highlight stats for any user (aggregates
-- only — never another user's private/non-gallery photos). Follower/following
-- counts are never returned (spec: counts hidden from everyone). Follows RLS
-- (own-row only) already exists.

create or replace function public.get_profile(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  prof public.profiles%rowtype;
  st public.streaks%rowtype;
  galleries int;
  crowns int;
  hearts int;
  wins jsonb;
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
  select coalesce(sum(vote_count + reaction_count), 0) into hearts
    from public.submissions where user_id = target;

  select coalesce(jsonb_agg(
           jsonb_build_object('id', id, 'thumb_path', thumb_path, 'is_potd', is_potd, 'drop_date', dd)
           order by dd desc
         ), '[]'::jsonb)
    into wins
  from (
    select s.id, s.thumb_path, s.is_potd, pd.drop_date as dd
    from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.user_id = target and s.in_gallery
    order by pd.drop_date desc
    limit 24
  ) w;

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
    'wins', wins,
    'is_self', target = me,
    'is_following', exists (select 1 from public.follows where follower_id = me and followee_id = target)
  );
end;
$$;

revoke execute on function public.get_profile(uuid) from public, anon;
grant  execute on function public.get_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_following_gallery — gallery placements from the people I follow (the
-- Following sub-tab). Pull surface, never a global feed.
-- ---------------------------------------------------------------------------
create or replace function public.get_following_gallery()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  photos jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select coalesce(jsonb_agg(row order by dd desc, potd desc, hearts desc), '[]'::jsonb)
    into photos
  from (
    select jsonb_build_object(
             'id', s.id,
             'thumb_path', s.thumb_path,
             'image_path', s.image_path,
             'user_id', s.user_id,
             'shooter', pr.username,
             'hearts', s.vote_count + s.reaction_count,
             'is_potd', s.is_potd,
             'captured_at', s.captured_at,
             'drop_date', pd.drop_date
           ) as row,
           pd.drop_date as dd, s.is_potd as potd, (s.vote_count + s.reaction_count) as hearts
    from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    join public.profiles pr on pr.id = s.user_id
    where s.in_gallery
      and s.user_id in (select followee_id from public.follows where follower_id = me)
    order by pd.drop_date desc, s.is_potd desc, (s.vote_count + s.reaction_count) desc
    limit 60
  ) q;

  return jsonb_build_object('photos', photos);
end;
$$;

revoke execute on function public.get_following_gallery() from public, anon;
grant  execute on function public.get_following_gallery() to authenticated;
