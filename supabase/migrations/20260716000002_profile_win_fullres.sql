-- Profile wins wall: carry image_path so a tapped win opens full-res.
--
-- The wins array only had thumb_path, so the profile could only ever open a win
-- at thumbnail resolution. Now that a win opens in an in-place fullscreen
-- lightbox (like the World/Following gallery), it needs the full-res object to
-- sign and render. image_path passes straight through decorate_photos /
-- filter_public_photos (both preserve the row object), so this is the only
-- change needed. Everything else is identical.
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
  owned jsonb;
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
           jsonb_build_object('id', id, 'thumb_path', thumb_path, 'image_path', image_path,
                              'is_potd', is_potd, 'user_id', target, 'drop_date', dd)
           order by dd desc
         ), '[]'::jsonb)
    into wins
  from (
    select s.id, s.thumb_path, s.image_path, s.is_potd, pd.drop_date as dd
    from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.user_id = target and s.in_gallery
    order by pd.drop_date desc
    limit 24
  ) w;

  -- Only the viewer's own unlocks — you never see what frames someone else owns,
  -- just the one they have equipped.
  select coalesce(jsonb_agg(frame_id), '[]'::jsonb) into owned
  from public.user_frames where user_id = me;

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
    'is_self', target = me,
    'is_following', exists (select 1 from public.follows where follower_id = me and followee_id = target)
  );
end;
$$;

revoke execute on function public.get_profile(uuid) from public, anon;
grant  execute on function public.get_profile(uuid) to authenticated;
