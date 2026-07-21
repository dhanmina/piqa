-- Admin Subject library: surface each Subject's technique hint in the list so the
-- /admin library screen can show + edit it inline (hint is written via
-- admin_set_subject_hint). Same shape as before + 'hint'. Ordered as the drop queue:
-- unused Subjects by seq first (what drops next), then used ones.
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
               'hint', p.hint,
               'is_sponsored', p.is_sponsored,
               'seq', p.seq,
               'used_at', p.used_at,
               'created_at', p.created_at,
               'in_use', exists (select 1 from public.subject_drops d where d.prompt_id = p.id)
             )
             order by (p.used_at is not null), p.seq asc nulls last, p.created_at
           )
    from public.subjects p
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.admin_list_prompts() from public, anon;
grant  execute on function public.admin_list_prompts() to authenticated;
