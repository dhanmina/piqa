-- Server-side content moderation (Phase 1.5A safety gate).
--
--  * submissions: content_label + content_score — set by the moderation edge
--    function after upload. Null = not yet scanned.
--  * profiles.blur_sensitive — user preference: blur flagged photos (default true).
--  * quarantine_if_flagged: RPC the edge function calls to quarantine a
--    photo that exceeds the nsfw_threshold.

-- ---------------------------------------------------------------------------
-- submissions — moderation columns
-- ---------------------------------------------------------------------------
alter table public.submissions
  add column if not exists content_label text,
  add column if not exists content_score real;

-- ---------------------------------------------------------------------------
-- profiles — blur preference
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists blur_sensitive boolean not null default true;

-- ---------------------------------------------------------------------------
-- quarantine_if_flagged — callback from the edge function (service role only).
-- Sets content_label + score, and quarantines if above threshold.
-- ---------------------------------------------------------------------------
create or replace function public.quarantine_if_flagged(
  p_submission uuid,
  p_label text,
  p_score real
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold real;
begin
  -- Only callable by service role (the edge function).
  if current_setting('role') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  threshold := public.cfg_num('nsfw_threshold', 0.7);

  update public.submissions
  set content_label = p_label,
      content_score = p_score,
      quarantined = quarantined or (p_score >= threshold and p_label is not null and p_label <> 'safe')
  where id = p_submission;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.quarantine_if_flagged(uuid, text, real) from public, anon, authenticated;
grant  execute on function public.quarantine_if_flagged(uuid, text, real) to service_role;

-- ---------------------------------------------------------------------------
-- config: moderation_scan_enabled — kill switch for the scan pipeline.
-- Set to false to disable all scans (e.g. if the edge function is down).
-- ---------------------------------------------------------------------------
insert into public.config (key, value) values
  ('moderation_scan_enabled', 'true')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- get_profile — add blur_sensitive to return payload (self-only).
-- ---------------------------------------------------------------------------
create or replace function public.get_profile(p_user uuid DEFAULT NULL::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  target uuid;
  prof public.profiles%rowtype;
  st public.streaks%rowtype;
  shots int;
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
  select count(*) + coalesce((select count(*) from public.free_shots where user_id = target), 0)
    into shots from public.submissions where user_id = target;
  select count(*) into galleries from public.submissions where user_id = target and in_gallery;
  select count(*) into crowns   from public.submissions where user_id = target and is_potd;
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

  select coalesce(jsonb_agg(frame_id), '[]'::jsonb) into owned
  from public.user_frames where user_id = me;

  select coalesce(jsonb_agg(ub.badge_type order by ub.earned_at), '[]'::jsonb) into badges
  from public.user_badges ub
  where ub.user_id = target;

  return jsonb_build_object(
    'found', true,
    'id', target,
    'username', prof.username,
    'avatar_url', prof.avatar_url,
    'xp', prof.xp,
    'shots', shots,
    'galleries', galleries,
    'streak_weeks', coalesce(st.current_weeks, 0),
    'hearts', hearts,
    'crowns', crowns,
    'wins', public.decorate_photos(public.filter_public_photos(wins, me)),
    'equipped_frame', prof.equipped_frame,
    'owned_frames', owned,
    'badges', badges,
    'is_self', target = me,
    'is_following', exists (select 1 from public.follows where follower_id = me and followee_id = target),
    'blur_sensitive', case when target = me then prof.blur_sensitive else null end
  );
end;
$function$
;

-- ---------------------------------------------------------------------------
-- toggle_blur_sensitive — flip the blur preference (self only).
-- ---------------------------------------------------------------------------
create or replace function public.toggle_blur_sensitive()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_val boolean;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.profiles set blur_sensitive = not blur_sensitive where id = uid
    returning blur_sensitive into new_val;
  return jsonb_build_object('ok', true, 'blur_sensitive', new_val);
end;
$$;

revoke execute on function public.toggle_blur_sensitive() from public, anon;
grant  execute on function public.toggle_blur_sensitive() to authenticated;

-- ---------------------------------------------------------------------------
-- decorate_photos — extend with content_label for the blur overlay.
-- The latest version adds content_label from submissions so the client
-- knows which photos to blur when blur_sensitive is enabled.
-- ---------------------------------------------------------------------------
create or replace function public.decorate_photos(p_photos jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
           t.ph || jsonb_build_object(
             'frame_id',      public.photo_frame(pd.drop_date),
             'day_number',    pd.day_number,
             'status',        public.photo_status(s.is_potd, s.gallery_rank),
             'content_label', s.content_label,
             'nods',          coalesce((
                                 select jsonb_object_agg(z.tag, z.cnt)
                                 from (
                                   select n.tag, count(*) as cnt
                                   from public.nods n
                                   where n.submission_id = s.id
                                   group by n.tag
                                 ) z
                               ), '{}'::jsonb)
           )
           order by t.ord
         ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) with ordinality as t(ph, ord)
  left join public.submissions   s  on s.id  = (t.ph ->> 'id')::uuid
  left join public.subject_drops pd on pd.id = s.drop_id;
$$;

revoke execute on function public.decorate_photos(jsonb) from public, anon;
grant  execute on function public.decorate_photos(jsonb) to authenticated, service_role;
