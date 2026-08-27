create function public.get_timeline_month(year int, month int)
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
  left join public.captures c on c.user_id = auth.uid() and c.captured_at = d::date
  left join public.frozen_dates f on f.user_id = auth.uid() and f.date = d::date
  order by day;
$$;
