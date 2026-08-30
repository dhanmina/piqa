-- Delete needs a capture id to target, but get_timeline_month only ever
-- returned storage_paths -- add capture_ids in the same array order so the
-- client can pair each photo with the id delete_capture() needs.
drop function if exists public.get_timeline_month(int, int);

create or replace function public.get_timeline_month(year int, month int)
returns table (day int, storage_paths text[], capture_ids uuid[], frozen boolean)
language sql security definer
as $$
  select
    extract(day from d)::int as day,
    c.storage_paths,
    c.capture_ids,
    (f.date is not null) as frozen
  from generate_series(
    make_date(year, month, 1),
    (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date,
    interval '1 day'
  ) d
  left join lateral (
    select array_agg(storage_path order by created_at asc) as storage_paths,
           array_agg(id order by created_at asc) as capture_ids
    from public.captures
    where user_id = auth.uid() and captured_at = d::date
  ) c on true
  left join public.frozen_dates f on f.user_id = auth.uid() and f.date = d::date
  order by day;
$$;
