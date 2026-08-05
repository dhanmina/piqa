-- admin_list_prompts() never returned 'angles', so the admin Subject editor's
-- 3 angle-hint fields always rendered blank on reopen even after a successful
-- save, and re-saving from a blank state would overwrite the saved angles with
-- fewer values. Re-created here from its true current body (verified last
-- redefined in 20260721000011_admin_list_hint.sql:5-36) with 'angles' added
-- next to 'hint'. No other change.
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
               'angles', p.angles,
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
