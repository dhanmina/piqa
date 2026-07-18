-- Admin phase 2/3 — Members, Analytics, Cosmetics (frames), and a general audit
-- feed. All admin-gated, security-definer, mutations audited. No service_role.

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_users(p_q text default '', p_limit int default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return coalesce((
    select jsonb_agg(row order by (row->>'created_at') desc)
    from (
      select jsonb_build_object(
               'id', p.id,
               'username', p.username,
               'region', p.region,
               'is_premium', p.is_premium,
               'is_admin', p.is_admin,
               'xp', p.xp,
               'created_at', p.created_at,
               'submissions', (select count(*) from public.submissions s where s.user_id = p.id and s.thumb_path is not null),
               'crowns', (select count(*) from public.submissions s where s.user_id = p.id and s.is_potd),
               'current_weeks', coalesce(st.current_weeks, 0),
               'days_this_week', coalesce(st.days_this_week, 0)
             ) as row
      from public.profiles p
      left join public.streaks st on st.user_id = p.id
      where p_q = '' or p.username ilike '%' || p_q || '%'
      order by p.created_at desc
      limit greatest(p_limit, 1)
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_search_users(text, int) from public, anon;
grant  execute on function public.admin_search_users(text, int) to authenticated;

create or replace function public.admin_set_premium(p_user uuid, p_value boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); before boolean;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  select is_premium into before from public.profiles where id = p_user;
  if before is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  update public.profiles set is_premium = p_value where id = p_user;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'member.premium', 'profile', p_user::text, jsonb_build_object('is_premium', before), jsonb_build_object('is_premium', p_value));
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_set_premium(uuid, boolean) from public, anon;
grant  execute on function public.admin_set_premium(uuid, boolean) to authenticated;

-- Grant/revoke admin. You can't strip your own admin (avoids locking yourself out).
create or replace function public.admin_set_user_admin(p_user uuid, p_value boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); before boolean;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if p_user = uid and p_value = false then return jsonb_build_object('ok', false, 'reason', 'cant_demote_self'); end if;
  select is_admin into before from public.profiles where id = p_user;
  if before is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  update public.profiles set is_admin = p_value where id = p_user;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'member.admin', 'profile', p_user::text, jsonb_build_object('is_admin', before), jsonb_build_object('is_admin', p_value));
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_set_user_admin(uuid, boolean) from public, anon;
grant  execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Analytics
-- ---------------------------------------------------------------------------
create or replace function public.admin_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  totals jsonb;
  daily jsonb;
  crowns jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  totals := jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'submissions', (select count(*) from public.submissions where thumb_path is not null),
    'votes', (select count(*) from public.votes),
    'prompts', (select count(*) from public.prompts),
    'prompts_unused', (select count(*) from public.prompts where used_at is null),
    'pending_reports', (select count(distinct submission_id) from public.reports where status = 'pending')
  );

  -- last 14 drop days, submissions + votes per day (summed across regions)
  daily := coalesce((
    select jsonb_agg(jsonb_build_object('date', d.drop_date, 'submissions', d.subs, 'votes', d.votes) order by d.drop_date)
    from (
      select pd.drop_date,
             sum((select count(*) from public.submissions s where s.drop_id = pd.id and s.thumb_path is not null)) as subs,
             sum((select count(*) from public.votes v where v.drop_id = pd.id)) as votes
      from public.prompt_drops pd
      group by pd.drop_date
      order by pd.drop_date desc
      limit 14
    ) d
  ), '[]'::jsonb);

  -- recent revealed days: who got the crown (or none)
  crowns := coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', c.drop_date, 'region', c.region, 'shooter', c.shooter, 'votes', c.votes
           ) order by c.drop_date desc)
    from (
      select pd.drop_date, pd.region,
             (select pr.username from public.submissions s join public.profiles pr on pr.id = s.user_id
              where s.drop_id = pd.id and s.is_potd limit 1) as shooter,
             (select count(*) from public.votes v where v.drop_id = pd.id) as votes
      from public.prompt_drops pd
      where pd.status = 'revealed'
      order by pd.drop_date desc
      limit 10
    ) c
  ), '[]'::jsonb);

  return jsonb_build_object('totals', totals, 'daily', daily, 'crowns', crowns);
end;
$$;

revoke execute on function public.admin_analytics() from public, anon;
grant  execute on function public.admin_analytics() to authenticated;

-- ---------------------------------------------------------------------------
-- Audit feed (all entities)
-- ---------------------------------------------------------------------------
create or replace function public.admin_recent_audit(p_limit int default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return coalesce((
    select jsonb_agg(row order by (row->>'at') desc)
    from (
      select jsonb_build_object(
               'actor', coalesce(pr.username, 'system'),
               'action', a.action,
               'entity', a.entity,
               'entity_id', a.entity_id,
               'before', a.before,
               'after', a.after,
               'at', a.created_at
             ) as row
      from public.audit_log a
      left join public.profiles pr on pr.id = a.actor_id
      order by a.created_at desc
      limit greatest(p_limit, 1)
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_recent_audit(int) from public, anon;
grant  execute on function public.admin_recent_audit(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Cosmetics (frames)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_frames()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'id', f.id, 'label', f.label,
               'ring_color', f.ring_color, 'profile_svg', f.profile_svg, 'marker_svg', f.marker_svg,
               'hairline_color', f.hairline_color, 'counter_color', f.counter_color,
               'suffix_text', f.suffix_text, 'suffix_color', f.suffix_color,
               'unlock_kind', f.unlock_kind, 'unlock_label', f.unlock_label,
               'event_start', f.event_start, 'event_end', f.event_end,
               'owners', (select count(*) from public.user_frames uf where uf.frame_id = f.id)
             ) order by f.id
           )
    from public.frames f
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_list_frames() from public, anon;
grant  execute on function public.admin_list_frames() to authenticated;

-- Upsert a frame's editable fields. The client sends the full current record, so a
-- straight upsert never drops a value. unlock_kind is validated against the CHECK.
create or replace function public.admin_save_frame(p_id text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); existed boolean;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if p_id is null or char_length(trim(p_id)) = 0 then return jsonb_build_object('ok', false, 'reason', 'bad_id'); end if;
  if coalesce(p_data->>'unlock_kind', 'manual') not in ('default','potd','event','manual') then
    return jsonb_build_object('ok', false, 'reason', 'bad_unlock_kind');
  end if;
  existed := exists (select 1 from public.frames where id = p_id);

  insert into public.frames as f
    (id, label, ring_color, profile_svg, marker_svg, hairline_color, counter_color,
     suffix_text, suffix_color, unlock_kind, unlock_label, event_start, event_end)
  values (
    p_id,
    coalesce(nullif(p_data->>'label',''), p_id),
    nullif(p_data->>'ring_color',''),
    nullif(p_data->>'profile_svg',''),
    nullif(p_data->>'marker_svg',''),
    coalesce(nullif(p_data->>'hairline_color',''), '#F2EDE4'),
    coalesce(nullif(p_data->>'counter_color',''), '#F2EDE4'),
    nullif(p_data->>'suffix_text',''),
    nullif(p_data->>'suffix_color',''),
    coalesce(nullif(p_data->>'unlock_kind',''), 'manual'),
    nullif(p_data->>'unlock_label',''),
    (nullif(p_data->>'event_start',''))::date,
    (nullif(p_data->>'event_end',''))::date
  )
  on conflict (id) do update set
    label = excluded.label, ring_color = excluded.ring_color, profile_svg = excluded.profile_svg,
    marker_svg = excluded.marker_svg, hairline_color = excluded.hairline_color, counter_color = excluded.counter_color,
    suffix_text = excluded.suffix_text, suffix_color = excluded.suffix_color,
    unlock_kind = excluded.unlock_kind, unlock_label = excluded.unlock_label,
    event_start = excluded.event_start, event_end = excluded.event_end;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (uid, case when existed then 'frame.update' else 'frame.create' end, 'frame', p_id, p_data);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_save_frame(text, jsonb) from public, anon;
grant  execute on function public.admin_save_frame(text, jsonb) to authenticated;

-- Manually grant a frame to a user (user_frames has no insert grant; this definer
-- function is the admin path). Idempotent.
create or replace function public.admin_grant_frame(p_user uuid, p_frame text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.frames where id = p_frame) then return jsonb_build_object('ok', false, 'reason', 'no_frame'); end if;
  if not exists (select 1 from public.profiles where id = p_user) then return jsonb_build_object('ok', false, 'reason', 'no_user'); end if;
  insert into public.user_frames (user_id, frame_id) values (p_user, p_frame) on conflict do nothing;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (uid, 'frame.grant', 'user_frame', p_user::text, jsonb_build_object('frame', p_frame));
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_grant_frame(uuid, text) from public, anon;
grant  execute on function public.admin_grant_frame(uuid, text) to authenticated;
