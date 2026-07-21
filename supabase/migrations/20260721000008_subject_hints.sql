-- Technique hints (learning loop · content engine): an optional one-line
-- photography tip on a Subject — the "stealth curriculum" (spec §3). Shown on the
-- live Shot card. Read via get_today_hint (deliberately off get_home_state); set
-- by admin.
alter table public.subjects add column if not exists hint text;

-- The hint for the user's current (most-recently-dropped) Subject, or null.
create or replace function public.get_today_hint()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  reg text;
  h   text;
begin
  if uid is null then return null; end if;
  select region into reg from public.profiles where id = uid;
  select s.hint into h
  from public.subject_drops sd
  join public.subjects s on s.id = sd.prompt_id
  where sd.region = reg and sd.drops_at <= now()
  order by sd.drops_at desc
  limit 1;
  return h;
end;
$$;
revoke execute on function public.get_today_hint() from public, anon;
grant  execute on function public.get_today_hint() to authenticated;

create or replace function public.admin_set_subject_hint(p_subject uuid, p_hint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  update public.subjects set hint = nullif(btrim(p_hint), '') where id = p_subject;
end;
$$;
revoke execute on function public.admin_set_subject_hint(uuid, text) from public, anon;
grant  execute on function public.admin_set_subject_hint(uuid, text) to authenticated;
