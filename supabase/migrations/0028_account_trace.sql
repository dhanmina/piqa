-- Backs Profile's whole-account-history trace (components/LifeTrace.tsx) --
-- unlike get_timeline_month, this needs no storage_path (no photo is shown,
-- just presence/absence per day), so it's a much cheaper per-day boolean scan
-- from account creation to today rather than a per-month join.
create function public.get_account_trace()
returns table (day date, captured boolean, frozen boolean)
language sql security definer
as $$
  select
    d::date as day,
    exists(select 1 from public.captures c where c.user_id = auth.uid() and c.captured_at = d::date) as captured,
    exists(select 1 from public.frozen_dates f where f.user_id = auth.uid() and f.date = d::date) as frozen
  from generate_series(
    (select created_at::date from public.profiles where id = auth.uid()),
    current_date,
    interval '1 day'
  ) d
  order by day;
$$;
