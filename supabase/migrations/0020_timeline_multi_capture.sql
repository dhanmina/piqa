-- 0011's dedupe collapsed each day to its single most-recent capture, but
-- today.tsx already supports multiple captures per day (todayCaptureCount,
-- CapturedTodayCard's "N photos" badge) — so any day with 2+ captures was
-- silently losing all but the newest one in the timeline/viewer. Return
-- every capture per day instead of just the latest.
drop function if exists public.get_timeline_month(int, int);

create or replace function public.get_timeline_month(year int, month int)
returns table (day int, storage_paths text[], frozen boolean)
language sql security definer
as $$
  select
    extract(day from d)::int as day,
    c.storage_paths,
    (f.date is not null) as frozen
  from generate_series(
    make_date(year, month, 1),
    (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date,
    interval '1 day'
  ) d
  left join lateral (
    select array_agg(storage_path order by created_at asc) as storage_paths
    from public.captures
    where user_id = auth.uid() and captured_at = d::date
  ) c on true
  left join public.frozen_dates f on f.user_id = auth.uid() and f.date = d::date
  order by day;
$$;
