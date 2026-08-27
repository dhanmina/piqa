-- Profile screen's mosaic tiles need a date to open a viewer with a real
-- accessibility label instead of an anonymous image.
drop function if exists public.get_profile_mosaic();

create function public.get_profile_mosaic()
returns table (storage_path text, captured_at date)
language sql security definer
as $$
  select storage_path, captured_at from public.captures where user_id = auth.uid() order by captured_at asc;
$$;
