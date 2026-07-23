-- Nods vocabulary: expand 5 -> 8 to cover every subject category.
--
-- The original 5 (great_light, strong_composition, bold_color, perfect_timing,
-- moved_me) left real gaps: nothing recognized wit/creativity (the `absurd`
-- category) or a fresh vantage (`pov`), and "bold color" misfits a mono/soft
-- shot. Add so_creative, fresh_perspective, tells_a_story so a fitting nod always
-- exists for any image. Ids are stable/machine-readable; the natural user-facing
-- labels live in the client (lib/nods.ts). 0 nods cast yet, so no data migration.

-- 1) Widen the CHECK on the tag column.
alter table public.nods drop constraint if exists nods_tag_check;
alter table public.nods add constraint nods_tag_check check (tag in (
  'great_light','strong_composition','bold_color','perfect_timing','moved_me',
  'so_creative','fresh_perspective','tells_a_story'
));

-- 2) Widen submit_nod's validation to match (body otherwise unchanged).
create or replace function public.submit_nod(p_submission uuid, p_tag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_tag not in (
    'great_light','strong_composition','bold_color','perfect_timing','moved_me',
    'so_creative','fresh_perspective','tells_a_story'
  ) then
    raise exception 'invalid_tag';
  end if;
  -- No self-nod (mirrors no-self-vote): you can't tag your own photo.
  if exists (select 1 from public.submissions s where s.id = p_submission and s.user_id = uid) then
    raise exception 'no_self_nod';
  end if;
  insert into public.nods (curator_id, submission_id, tag)
  values (uid, p_submission, p_tag)
  on conflict (curator_id, submission_id) do update set tag = excluded.tag, created_at = now();
end;
$$;
revoke execute on function public.submit_nod(uuid, text) from public, anon;
grant  execute on function public.submit_nod(uuid, text) to authenticated;
