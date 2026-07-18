-- Admin prompt library — CRUD over the prompts the scheduler draws from. Admin-
-- gated, security-definer (so writes bypass the players' read-only grant), audited.
-- Category is validated against the same CHECK the table enforces. A prompt that's
-- already tied to a drop can't be deleted (FK RESTRICT keeps history intact).

create or replace function public.admin_list_prompts()
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
    select jsonb_agg(
             jsonb_build_object(
               'id', p.id,
               'text', p.text,
               'category', p.category,
               'is_sponsored', p.is_sponsored,
               'seq', p.seq,
               'used_at', p.used_at,
               'created_at', p.created_at,
               'in_use', exists (select 1 from public.prompt_drops d where d.prompt_id = p.id)
             )
             order by (p.used_at is not null), p.seq asc nulls last, p.created_at
           )
    from public.prompts p
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_list_prompts() from public, anon;
grant  execute on function public.admin_list_prompts() to authenticated;

create or replace function public.admin_create_prompt(
  p_text text,
  p_category text,
  p_is_sponsored boolean default false,
  p_seq int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nid uuid;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if p_text is null or char_length(trim(p_text)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_text');
  end if;
  if p_category not in ('object', 'color', 'light', 'pov', 'emotion', 'absurd') then
    return jsonb_build_object('ok', false, 'reason', 'bad_category');
  end if;

  insert into public.prompts (text, category, is_sponsored, seq)
  values (trim(p_text), p_category, coalesce(p_is_sponsored, false), p_seq)
  returning id into nid;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (uid, 'prompt.create', 'prompt', nid::text,
          jsonb_build_object('text', trim(p_text), 'category', p_category, 'is_sponsored', coalesce(p_is_sponsored, false), 'seq', p_seq));

  return jsonb_build_object('ok', true, 'id', nid);
end;
$$;

revoke execute on function public.admin_create_prompt(text, text, boolean, int) from public, anon;
grant  execute on function public.admin_create_prompt(text, text, boolean, int) to authenticated;

create or replace function public.admin_update_prompt(
  p_id uuid,
  p_text text,
  p_category text,
  p_is_sponsored boolean,
  p_seq int
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
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if p_text is null or char_length(trim(p_text)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_text');
  end if;
  if p_category not in ('object', 'color', 'light', 'pov', 'emotion', 'absurd') then
    return jsonb_build_object('ok', false, 'reason', 'bad_category');
  end if;

  select jsonb_build_object('text', text, 'category', category, 'is_sponsored', is_sponsored, 'seq', seq)
    into before
  from public.prompts where id = p_id;
  if before is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.prompts
    set text = trim(p_text), category = p_category, is_sponsored = coalesce(p_is_sponsored, false), seq = p_seq
    where id = p_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'prompt.update', 'prompt', p_id::text, before,
          jsonb_build_object('text', trim(p_text), 'category', p_category, 'is_sponsored', coalesce(p_is_sponsored, false), 'seq', p_seq));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_update_prompt(uuid, text, text, boolean, int) from public, anon;
grant  execute on function public.admin_update_prompt(uuid, text, text, boolean, int) to authenticated;

create or replace function public.admin_delete_prompt(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  before jsonb;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if exists (select 1 from public.prompt_drops d where d.prompt_id = p_id) then
    return jsonb_build_object('ok', false, 'reason', 'in_use');
  end if;

  select jsonb_build_object('text', text, 'category', category, 'is_sponsored', is_sponsored, 'seq', seq)
    into before
  from public.prompts where id = p_id;
  if before is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  delete from public.prompts where id = p_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values (uid, 'prompt.delete', 'prompt', p_id::text, before);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_delete_prompt(uuid) from public, anon;
grant  execute on function public.admin_delete_prompt(uuid) to authenticated;
