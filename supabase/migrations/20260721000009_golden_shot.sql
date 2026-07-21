-- Golden Shot (content engine · spec §3 "weekly Golden Prompt event"): a special
-- Subject drop with a gold treatment on the Shot card. is_golden lives on the drop
-- (per-day). Read via get_today_golden (off get_home_state); admin-set.
alter table public.subject_drops add column if not exists is_golden boolean not null default false;

create or replace function public.get_today_golden()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  reg text;
  g   boolean;
begin
  if uid is null then return false; end if;
  select region into reg from public.profiles where id = uid;
  select sd.is_golden into g
  from public.subject_drops sd
  where sd.region = reg and sd.drops_at <= now()
  order by sd.drops_at desc
  limit 1;
  return coalesce(g, false);
end;
$$;
revoke execute on function public.get_today_golden() from public, anon;
grant  execute on function public.get_today_golden() to authenticated;

create or replace function public.admin_set_golden(p_drop uuid, p_golden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  update public.subject_drops set is_golden = coalesce(p_golden, false) where id = p_drop;
end;
$$;
revoke execute on function public.admin_set_golden(uuid, boolean) from public, anon;
grant  execute on function public.admin_set_golden(uuid, boolean) to authenticated;
