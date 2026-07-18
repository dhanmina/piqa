-- Admin config history — read the audit_log back so Config Studio can show, per
-- key, who last changed it and the full trail. Both are admin-only, definer-gated.

-- Most-recent change per config key: { key: { actor, at } }. One call powers the
-- "changed 3d ago by …" line on every field.
create or replace function public.admin_config_last_changes()
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
    select jsonb_object_agg(entity_id, info)
    from (
      select distinct on (a.entity_id)
             a.entity_id,
             jsonb_build_object(
               'actor', coalesce(pr.username, 'system'),
               'at', a.created_at
             ) as info
      from public.audit_log a
      left join public.profiles pr on pr.id = a.actor_id
      where a.entity = 'config'
      order by a.entity_id, a.created_at desc
    ) q
  ), '{}'::jsonb);
end;
$$;

revoke execute on function public.admin_config_last_changes() from public, anon;
grant  execute on function public.admin_config_last_changes() to authenticated;

-- Full trail for one key, newest first.
create or replace function public.admin_config_history(p_key text, p_limit int default 12)
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
    select jsonb_agg(row order by (row->>'at') desc)
    from (
      select jsonb_build_object(
               'actor', coalesce(pr.username, 'system'),
               'before', a.before,
               'after', a.after,
               'at', a.created_at
             ) as row
      from public.audit_log a
      left join public.profiles pr on pr.id = a.actor_id
      where a.entity = 'config' and a.entity_id = p_key
      order by a.created_at desc
      limit greatest(p_limit, 1)
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_config_history(text, int) from public, anon;
grant  execute on function public.admin_config_history(text, int) to authenticated;
