-- Admin drop scheduler — read the daily loop and drive it. All admin-gated,
-- security-definer. The privileged worker functions (drop_prompt, close_day) are
-- service_role-only; these wrappers run as the function owner, so an admin can
-- call them through the anon key without ever holding a service_role secret.
-- Every lifecycle action writes an audit_log row.

-- Recent drops across regions, with the prompt text (admin sees it even before a
-- drop goes live, which the prompts RLS hides from players) and live counts.
create or replace function public.admin_list_drops(p_limit int default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(row order by (row->>'drop_date') desc, row->>'region')
    from (
      select jsonb_build_object(
               'id', pd.id,
               'region', pd.region,
               'drop_date', pd.drop_date,
               'drops_at', pd.drops_at,
               'submit_closes_at', pd.submit_closes_at,
               'voting_closes_at', pd.voting_closes_at,
               'status', pd.status,
               'prompt_id', pd.prompt_id,
               'prompt_text', pr.text,
               'category', pr.category,
               'is_sponsored', pr.is_sponsored,
               'submissions', (select count(*) from public.submissions s where s.drop_id = pd.id and s.thumb_path is not null),
               'votes', (select count(*) from public.votes v where v.drop_id = pd.id),
               'revealed', exists (select 1 from public.galleries g where g.drop_id = pd.id)
             ) as row
      from public.prompt_drops pd
      join public.prompts pr on pr.id = pd.prompt_id
      order by pd.drop_date desc, pd.region
      limit greatest(p_limit, 1)
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_list_drops(int) from public, anon;
grant  execute on function public.admin_list_drops(int) to authenticated;

-- Preview the prompt drop_prompt() would pick next for a region (the arc order),
-- and whether today's drop already exists.
create or replace function public.admin_next_prompt(p_region text default 'BETA')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  chosen record;
  today_local date := (now() at time zone 'Asia/Manila')::date;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  if exists (select 1 from public.prompt_drops where region = p_region and drop_date = today_local) then
    return jsonb_build_object('has_today', true, 'prompt', null);
  end if;
  select id, text, category into chosen
  from public.prompts
  order by used_at asc nulls first, seq asc nulls last, random()
  limit 1;
  if chosen.id is null then
    return jsonb_build_object('has_today', false, 'prompt', null);
  end if;
  return jsonb_build_object(
    'has_today', false,
    'prompt', jsonb_build_object('id', chosen.id, 'text', chosen.text, 'category', chosen.category)
  );
end;
$$;

revoke execute on function public.admin_next_prompt(text) from public, anon;
grant  execute on function public.admin_next_prompt(text) to authenticated;

-- Create today's drop for a region (wraps drop_prompt), audited.
create or replace function public.admin_drop_next(p_region text default 'BETA')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  res jsonb;
begin
  if not public.is_admin(uid) then
    raise exception 'not_authorized';
  end if;
  res := public.drop_prompt(p_region);
  if coalesce((res->>'created')::boolean, false) then
    insert into public.audit_log (actor_id, action, entity, entity_id, after)
    values (uid, 'drop.create', 'prompt_drop', res->>'drop_id', res);
  end if;
  return res;
end;
$$;

revoke execute on function public.admin_drop_next(text) from public, anon;
grant  execute on function public.admin_drop_next(text) to authenticated;

-- Close / reveal a drop (wraps close_day), audited.
create or replace function public.admin_close_day(p_drop uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  before_status text;
  res jsonb;
begin
  if not public.is_admin(uid) then
    raise exception 'not_authorized';
  end if;
  select status into before_status from public.prompt_drops where id = p_drop;
  res := public.close_day(p_drop);
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'drop.close', 'prompt_drop', p_drop::text, jsonb_build_object('status', before_status), res);
  return res;
end;
$$;

revoke execute on function public.admin_close_day(uuid) from public, anon;
grant  execute on function public.admin_close_day(uuid) to authenticated;

-- Reschedule a drop's windows (only before it's revealed), audited.
create or replace function public.admin_update_drop_times(
  p_drop uuid,
  p_drops_at timestamptz,
  p_submit_closes_at timestamptz,
  p_voting_closes_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  before jsonb;
begin
  if not public.is_admin(uid) then
    raise exception 'not_authorized';
  end if;
  if exists (select 1 from public.galleries where drop_id = p_drop) then
    return jsonb_build_object('ok', false, 'reason', 'already_revealed');
  end if;
  if not (p_drops_at < p_submit_closes_at and p_submit_closes_at <= p_voting_closes_at) then
    return jsonb_build_object('ok', false, 'reason', 'bad_order');
  end if;
  select jsonb_build_object(
           'drops_at', drops_at, 'submit_closes_at', submit_closes_at, 'voting_closes_at', voting_closes_at
         ) into before
  from public.prompt_drops where id = p_drop;

  update public.prompt_drops
    set drops_at = p_drops_at, submit_closes_at = p_submit_closes_at, voting_closes_at = p_voting_closes_at
    where id = p_drop;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'drop.reschedule', 'prompt_drop', p_drop::text, before,
          jsonb_build_object('drops_at', p_drops_at, 'submit_closes_at', p_submit_closes_at, 'voting_closes_at', p_voting_closes_at));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_update_drop_times(uuid, timestamptz, timestamptz, timestamptz) from public, anon;
grant  execute on function public.admin_update_drop_times(uuid, timestamptz, timestamptz, timestamptz) to authenticated;
