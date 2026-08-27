-- Profile's mosaic was unbounded and oldest-first: a long-tenured user's
-- every visit re-signed hundreds of storage URLs, and the newest (most
-- relevant) photos sat at the bottom of the scroll. Cap to the most recent
-- 27 (a multiple of the 3-column grid) newest-first; Timeline already
-- paginates by month and is where "see everything" belongs.
drop function if exists public.get_profile_mosaic();

create function public.get_profile_mosaic()
returns table (storage_path text, captured_at date)
language sql security definer
as $$
  select storage_path, captured_at
  from public.captures
  where user_id = auth.uid()
  order by captured_at desc
  limit 27;
$$;
