-- Switch admin RPC default region from BETA to PH.
create or replace function public.admin_next_prompt(p_region text default 'PH')
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

create or replace function public.admin_drop_next(p_region text default 'PH')
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
