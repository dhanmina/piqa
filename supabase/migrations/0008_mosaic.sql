create function public.get_profile_mosaic()
returns table (storage_path text)
language sql security definer
as $$
  select storage_path from public.captures where user_id = auth.uid() order by captured_at asc;
$$;
