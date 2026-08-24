create function public.get_peek_back()
returns table (storage_path text, captured_at date, label text)
language plpgsql security definer
as $$
declare
  today date := current_date;
begin
  return query
    select c.storage_path, c.captured_at, 'last week'
    from public.captures c
    where c.user_id = auth.uid() and c.captured_at = today - 7
    limit 1;
  if found then return; end if;

  return query
    select c.storage_path, c.captured_at, 'last month'
    from public.captures c
    where c.user_id = auth.uid() and c.captured_at = today - interval '1 month'
    limit 1;
  if found then return; end if;

  return query
    select c.storage_path, c.captured_at, 'a year ago'
    from public.captures c
    where c.user_id = auth.uid() and c.captured_at = today - interval '1 year'
    limit 1;
  if found then return; end if;

  return query
    select c.storage_path, c.captured_at, 'from your archive'
    from public.captures c
    where c.user_id = auth.uid() and c.captured_at < today
    order by random()
    limit 1;
end;
$$;
