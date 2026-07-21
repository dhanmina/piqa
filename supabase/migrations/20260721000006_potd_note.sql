-- "Why this won" (learning loop · build-steps 1C): a one-line editorial note on
-- the Photo of the Day, shown on the PotD detail so the daily reveal teaches a
-- lesson. Admin-set. Read via the existing "gallery submissions are public" RLS,
-- so NO changes to decorate_photos / get_gallery (kept off that pipeline on purpose).
alter table public.submissions add column if not exists potd_note text;

create or replace function public.admin_set_potd_note(p_submission uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  update public.submissions
     set potd_note = nullif(btrim(p_note), '')
   where id = p_submission;
end;
$$;
revoke execute on function public.admin_set_potd_note(uuid, text) from public, anon;
grant  execute on function public.admin_set_potd_note(uuid, text) to authenticated;
