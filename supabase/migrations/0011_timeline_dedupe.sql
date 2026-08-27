-- get_timeline_month can return more than one row per day when a user has
-- multiple captures on the same date (nothing prevents that at the DB or
-- queue level). Collapse to the most recent capture per day, matching the
-- precedent in today.tsx's own "latest capture for today" query.
create or replace function public.get_timeline_month(year int, month int)
returns table (day int, storage_path text, frozen boolean)
language sql security definer
as $$
  select
    extract(day from d)::int as day,
    c.storage_path,
    (f.date is not null) as frozen
  from generate_series(
    make_date(year, month, 1),
    (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date,
    interval '1 day'
  ) d
  left join lateral (
    select storage_path
    from public.captures
    where user_id = auth.uid() and captured_at = d::date
    order by created_at desc
    limit 1
  ) c on true
  left join public.frozen_dates f on f.user_id = auth.uid() and f.date = d::date
  order by day;
$$;
