-- Studios screen felt static: the face pile carried no "did they shoot today"
-- signal (get_studio_members already computed it, get_studio's members_preview
-- didn't), and joining a Studio was silent to everyone already in it. Neither
-- fix touches the fairness laws — presence is still yes/no, never a count or
-- an order; the join push mirrors the existing nudge_studio_director pattern.

-- ---------------------------------------------------------------------------
-- get_studio() — add submitted_today per member to members_preview, same
-- definition already used by get_studio_members(). Everything else unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.get_studio()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.studios%rowtype;
  v_region text;
  member_count int;
  made_count int;
  latest_drop record;
  streak_days int := 0;
  d record;
  hit boolean;
  members_preview jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select s.* into st from public.studios s
    join public.studio_members sm on sm.studio_id = s.id
    where sm.user_id = uid;
  if st.id is null then
    return jsonb_build_object('found', false);
  end if;

  select region into v_region from public.profiles where id = st.director_id;
  select count(*) into member_count from public.studio_members where studio_id = st.id;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', pr.id,
             'username', pr.username,
             'avatar_url', pr.avatar_url,
             'submitted_today', exists (
               select 1
               from public.subject_drops pd
               join public.submissions sub
                 on sub.drop_id = pd.id and sub.user_id = pr.id and sub.thumb_path is not null
               where pd.region = pr.region
                 and now() >= pd.drops_at and now() < pd.submit_closes_at
             )
           )
           order by (pr.id = st.director_id) desc, sm.joined_at asc
         ), '[]'::jsonb)
    into members_preview
  from public.studio_members sm
  join public.profiles pr on pr.id = sm.user_id
  where sm.studio_id = st.id;

  -- Standing: the latest revealed drop in the anchor region, and how many
  -- members' shots made that gallery. Never a ranked list — a single aggregate.
  select pd.id, pd.drop_date into latest_drop
  from public.subject_drops pd
  where pd.region = v_region and pd.status = 'revealed'
  order by pd.drop_date desc
  limit 1;

  made_count := 0;
  if latest_drop.id is not null then
    select count(*) into made_count
    from public.submissions s
    join public.studio_members sm on sm.user_id = s.user_id
    where sm.studio_id = st.id and s.drop_id = latest_drop.id and s.in_gallery;
  end if;

  -- Shared streak: consecutive revealed days (most recent first) where at least
  -- one member submitted a daily shot. Capped at 120 days back so this can never
  -- run away on old data.
  for d in
    select pd.id, pd.drop_date
    from public.subject_drops pd
    where pd.region = v_region and pd.status = 'revealed'
    order by pd.drop_date desc
    limit 120
  loop
    select exists (
      select 1 from public.submissions s
      join public.studio_members sm on sm.user_id = s.user_id
      where sm.studio_id = st.id and s.drop_id = d.id and s.thumb_path is not null
    ) into hit;
    exit when not hit;
    streak_days := streak_days + 1;
  end loop;

  return jsonb_build_object(
    'found', true,
    'id', st.id,
    'name', st.name,
    'invite_code', st.invite_code,
    'is_director', st.director_id = uid,
    'member_count', member_count,
    'members_preview', members_preview,
    'standing_made', made_count,
    'standing_of', member_count,
    'streak_days', streak_days
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- join_studio_by_code(code) — unchanged behavior, plus a 'social'-category
-- push to the Studio's existing members (not the joiner) so a join is noticed
-- without reopening the tab. Best-effort: push failures never block the join.
-- ---------------------------------------------------------------------------
create or replace function public.join_studio_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.studios%rowtype;
  cap int := public.cfg_int('studio_member_cap', 8);
  member_count int;
  uname text;
  notify_ids uuid[];
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.studio_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end if;

  select * into target from public.studios
    where invite_code = upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  if target.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select count(*) into member_count from public.studio_members where studio_id = target.id;
  if member_count >= cap then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  select array_agg(user_id) into notify_ids
  from public.studio_members where studio_id = target.id;

  insert into public.studio_members (user_id, studio_id) values (uid, target.id);

  if notify_ids is not null then
    select username into uname from public.profiles where id = uid;
    perform public.send_push(
      'New Studio member',
      coalesce(uname, 'Someone') || ' joined ' || target.name,
      jsonb_build_object('type', 'studio_member_joined'),
      null, notify_ids, 'social'
    );
  end if;

  return jsonb_build_object('ok', true, 'studio_id', target.id);
end;
$$;
