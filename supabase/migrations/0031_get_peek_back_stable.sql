-- get_peek_back's archive fallback used `order by random()`, re-rolled on every
-- call. today.tsx's useFocusEffect reruns loadToday on every return-to-tab, so
-- users without an exact anniversary capture saw a different "peek back" photo
-- each time they revisited the Today tab. Order by a hash of (id, day) instead:
-- stable for a given user+day, still varies day to day. Also accept the
-- caller's local date, matching get_today_state (0024), since current_date is
-- UTC and disagrees with captures.captured_at near local midnight.
drop function if exists public.get_peek_back();

create function public.get_peek_back(p_today date default current_date)
returns table (storage_path text, captured_at date, label text)
language plpgsql security definer
as $$
declare
  today date := p_today;
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
    order by md5(c.storage_path || today::text)
    limit 1;
end;
$$;
