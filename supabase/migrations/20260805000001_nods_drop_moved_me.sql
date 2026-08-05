-- Drop moved_me from the nod vocabulary: it was defined in NOD_LABELS but
-- never wired into any category picker (lib/services/nods.ts NODS_BY_CATEGORY),
-- so it was unreachable from the client since the 8-tag expansion. Client-side
-- fix already dropped it from NOD_LABELS; this closes the gap server-side so
-- submit_nod rejects it going forward.
--
-- NOT VALID: any historical moved_me rows (cast before the 8-tag expansion,
-- when it was one of the original 5) stay valid and readable — this only
-- blocks new inserts, it does not scan/fail on existing data.

alter table public.nods drop constraint if exists nods_tag_check;
alter table public.nods add constraint nods_tag_check check (tag in (
  'great_light','strong_composition','bold_color','perfect_timing',
  'so_creative','fresh_perspective','tells_a_story'
)) not valid;

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
    'great_light','strong_composition','bold_color','perfect_timing',
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
