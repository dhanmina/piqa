-- Phase 4 · Step 5 — Archive stars (spec §11c, §13).
--
-- Any shot (free capture or daily submission) can be starred to keep it full-res
-- (anti-ransom), capped at stars_per_month per calendar month. free_shots.starred
-- already exists; submissions gains one. starred_at lets us count this month's
-- stars (and free a slot when un-starred within the month). The cap is enforced
-- server-side in toggle_star.

alter table public.submissions
  add column if not exists starred    boolean not null default false,
  add column if not exists starred_at timestamptz;

alter table public.free_shots
  add column if not exists starred_at timestamptz;

create index if not exists submissions_starred_idx on public.submissions (user_id) where starred;
create index if not exists free_shots_starred_idx  on public.free_shots  (user_id) where starred;

-- ---------------------------------------------------------------------------
-- toggle_star(type, id) — star/un-star one of the caller's own shots, enforcing
-- the monthly cap across both tables. Returns the new state + this month's tally.
-- ---------------------------------------------------------------------------
create or replace function public.toggle_star(p_type text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int := public.cfg_int('stars_per_month', 5);
  month_start date := date_trunc('month', now())::date;
  cur_starred boolean;
  used int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_type not in ('free', 'daily') then
    return jsonb_build_object('ok', false, 'reason', 'bad_type');
  end if;

  if p_type = 'free' then
    select starred into cur_starred from public.free_shots where id = p_id and user_id = uid;
  else
    select starred into cur_starred from public.submissions where id = p_id and user_id = uid;
  end if;
  if cur_starred is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select
      (select count(*) from public.free_shots  where user_id = uid and starred and starred_at >= month_start)
    + (select count(*) from public.submissions where user_id = uid and starred and starred_at >= month_start)
    into used;

  if cur_starred then
    -- Un-star (frees this month's slot if it was one).
    if p_type = 'free' then
      update public.free_shots  set starred = false where id = p_id and user_id = uid;
    else
      update public.submissions set starred = false where id = p_id and user_id = uid;
    end if;
    select
        (select count(*) from public.free_shots  where user_id = uid and starred and starred_at >= month_start)
      + (select count(*) from public.submissions where user_id = uid and starred and starred_at >= month_start)
      into used;
    return jsonb_build_object('ok', true, 'starred', false, 'used', used, 'cap', cap);
  else
    if used >= cap then
      return jsonb_build_object('ok', false, 'reason', 'cap', 'used', used, 'cap', cap);
    end if;
    if p_type = 'free' then
      update public.free_shots  set starred = true, starred_at = now() where id = p_id and user_id = uid;
    else
      update public.submissions set starred = true, starred_at = now() where id = p_id and user_id = uid;
    end if;
    return jsonb_build_object('ok', true, 'starred', true, 'used', used + 1, 'cap', cap);
  end if;
end;
$$;

revoke execute on function public.toggle_star(text, uuid) from public, anon;
grant  execute on function public.toggle_star(text, uuid) to authenticated;
