-- streaks and frozen_dates tables
create table public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_count int not null default 0,
  longest_count int not null default 0,
  last_capture_date date,
  freezes_remaining int not null default 2,
  freeze_week_start date not null default date_trunc('week', now())::date + 1
);

create table public.frozen_dates (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  primary key (user_id, date)
);

alter table public.streaks enable row level security;
alter table public.frozen_dates enable row level security;

create policy "streaks_select_own" on public.streaks for select using (auth.uid() = user_id);
create policy "frozen_dates_select_own" on public.frozen_dates for select using (auth.uid() = user_id);

grant select on public.streaks to authenticated;
grant select on public.frozen_dates to authenticated;

-- get_today_state RPC
create function public.get_today_state()
returns table (current_count int, longest_count int, freezes_remaining int, captured_today boolean)
language plpgsql security definer
as $$
declare
  s public.streaks%rowtype;
  today date := current_date;
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

create function public.record_capture_streak()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  new_count int;
begin
  select case
    when last_capture_date = new.captured_at then current_count
    when last_capture_date = new.captured_at - 1 then current_count + 1
    else 1
  end into new_count
  from public.streaks where user_id = new.user_id;

  update public.streaks
    set current_count = new_count,
        last_capture_date = greatest(coalesce(last_capture_date, new.captured_at), new.captured_at),
        longest_count = greatest(longest_count, new_count)
    where user_id = new.user_id;
  return new;
end;
$$;

create trigger on_capture_update_streak
  after insert on public.captures
  for each row execute function public.record_capture_streak();

-- Extend Task 1's signup trigger so every new user gets a default streaks row
-- (current_count/longest_count/freezes_remaining all default correctly).
-- Without this, get_today_state() sees no row and returns NULLs for real users.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'user_' || replace(new.id::text, '-', ''),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = '';
