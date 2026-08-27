create function public.get_grand_recap()
returns table (storage_path text, captured_at date)
language sql security definer
as $$
  select storage_path, captured_at
  from public.captures
  where user_id = auth.uid() and captured_at >= current_date - 365
  order by captured_at asc;
$$;
