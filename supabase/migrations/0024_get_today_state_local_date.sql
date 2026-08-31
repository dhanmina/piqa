-- get_today_state compared captures.captured_at (written using the device's local
-- date, see lib/captureQueue.ts) against Postgres current_date, which is UTC. For
-- any user not at UTC+0 the two dates disagree near local midnight, so
-- captured_today (and the freeze/gap logic, which also runs off `today`) could
-- desync from what the client just wrote. Accept the caller's local date instead,
-- defaulting to current_date so existing zero-arg callers (pgTAP tests) still work.
drop function if exists public.get_today_state();

create function public.get_today_state(p_today date default current_date)
returns table (current_count int, longest_count int, freezes_remaining int, captured_today boolean)
language plpgsql security definer
as $$
declare
  s public.streaks%rowtype;
  today date := p_today;
  this_sunday date := today - extract(dow from today)::int;
  gap_days int;
  d date;
begin
  select * into s from public.streaks where user_id = auth.uid();

  if this_sunday <> s.freeze_week_start then
    update public.streaks set freezes_remaining = 2, freeze_week_start = this_sunday
      where user_id = auth.uid();
    s.freezes_remaining := 2;
    s.freeze_week_start := this_sunday;
  end if;

  if s.last_capture_date is not null and s.last_capture_date < today - 1 then
    gap_days := today - s.last_capture_date - 1;
    d := s.last_capture_date + 1;
    while d < today loop
      if s.freezes_remaining > 0 then
        insert into public.frozen_dates (user_id, date) values (auth.uid(), d)
          on conflict do nothing;
        s.freezes_remaining := s.freezes_remaining - 1;
      else
        s.current_count := 0;
      end if;
      d := d + 1;
    end loop;
    s.last_capture_date := today - 1;
    update public.streaks
      set freezes_remaining = s.freezes_remaining, current_count = s.current_count,
          last_capture_date = s.last_capture_date
      where user_id = auth.uid();
  end if;

  return query select s.current_count, s.longest_count, s.freezes_remaining,
    exists(select 1 from public.captures c where c.user_id = auth.uid() and c.captured_at = today);
end;
$$;
