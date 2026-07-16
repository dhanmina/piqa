-- Light the flame at submission, not only at day-close.
--
-- evaluate_streak (the only writer that lit the flame) runs at close_day, so a
-- shot lit its calendar dot live but left is_alive/days_alive stale until the
-- day closed — you'd see filled dots beside a 0/unlit flame. Worse, the
-- dead->alive branch started the flame on the CLOSING day, throwing away the
-- earlier days of the run (a 3-day run would light at "day 1").
--
-- Fix, three parts:
--   1. streak_window_start(): the first shot-day in the trailing window — the
--      day the flame really should have lit.
--   2. evaluate_streak dead->alive now backdates to that day (correct at close).
--   3. An AFTER INSERT trigger on submissions lights/refreshes the flame the
--      moment you shoot. Survival + shield regen stay at close — a submission
--      only ever helps you, never breaks you.
-- Plus a one-time backfill so streaks stuck dead from the old behaviour relight.

-- 1. Earliest distinct daily-submission day within the trailing window (<= as_of).
create or replace function public.streak_window_start(p_uid uuid, p_as_of date)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select min(pd.drop_date)
  from public.submissions s
  join public.prompt_drops pd on pd.id = s.drop_id
  where s.user_id = p_uid
    and s.thumb_path is not null
    and pd.drop_date > p_as_of - public.cfg_int('streak_window_days', 7)
    and pd.drop_date <= p_as_of;
$$;

revoke execute on function public.streak_window_start(uuid, date) from public, anon, authenticated;

-- 2. evaluate_streak — identical to the days-alive model, except the dead->alive
--    branch backdates flame_started_on to the run's first day (single line).
create or replace function public.evaluate_streak(p_uid uuid, p_as_of date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.streaks%rowtype;
  win    int := public.cfg_int('streak_window_days', 7);
  mind   int := public.cfg_int('streak_min_days', 4);
  smax   int := public.cfg_int('streak_shield_max', 1);
  sregen int := public.cfg_int('streak_shield_regen', 1);
  did_today boolean;
  days_win  int;
  was_alive boolean;
  new_alive boolean;
  new_started date;
  new_shields int;
  new_comeback boolean;
  age int;
  new_days int;
begin
  select * into st from public.streaks where user_id = p_uid;
  if st.user_id is null then return; end if;

  did_today := exists (
    select 1 from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.user_id = p_uid and s.thumb_path is not null and pd.drop_date = p_as_of
  );

  select count(distinct pd.drop_date) into days_win
  from public.submissions s
  join public.prompt_drops pd on pd.id = s.drop_id
  where s.user_id = p_uid and s.thumb_path is not null
    and pd.drop_date > p_as_of - win and pd.drop_date <= p_as_of;

  was_alive    := st.is_alive;
  new_alive    := was_alive;
  new_started  := st.flame_started_on;
  new_shields  := st.shields;
  new_comeback := st.comeback_pending;

  if not was_alive then
    -- The flame lights on the first submission of the run — backdated so a run
    -- that only closes now still counts from the day it truly began.
    if did_today then
      new_alive   := true;
      new_started := coalesce(public.streak_window_start(p_uid, p_as_of), p_as_of);
      new_shields := smax;
    end if;
  else
    new_started := coalesce(st.flame_started_on, p_as_of);
    age := p_as_of - new_started;
    if age >= win and days_win < mind then
      if st.shields > 0 then
        new_shields := st.shields - 1;
        new_alive   := true;
      else
        new_alive    := false;
        new_started  := null;
        new_shields  := 0;
        new_comeback := true;
      end if;
    elsif age > 0 and (age % win) = 0 then
      new_shields := least(st.shields + sregen, smax);
    end if;
  end if;

  new_days := case when new_alive and new_started is not null then (p_as_of - new_started) + 1 else 0 end;

  update public.streaks
    set is_alive         = new_alive,
        flame_started_on = new_started,
        days_alive       = new_days,
        current_weeks    = new_days,
        days_this_week   = days_win,
        shields          = new_shields,
        week_anchor      = new_started,
        comeback_pending = new_comeback,
        last_active      = case when did_today then p_as_of else st.last_active end,
        updated_at       = now()
    where user_id = p_uid;
end;
$$;

revoke execute on function public.evaluate_streak(uuid, date) from public, anon, authenticated;
grant  execute on function public.evaluate_streak(uuid, date) to service_role;

-- 3. Light/refresh the flame the moment a daily shot lands.
create or replace function public.streak_touch_on_submit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  as_of date;
  first_day date;
  days_win int;
  smax int := public.cfg_int('streak_shield_max', 1);
  win  int := public.cfg_int('streak_window_days', 7);
  st public.streaks%rowtype;
begin
  -- Daily shots only (a real photo tied to a drop). Practice goes to free_shots.
  if new.thumb_path is null or new.drop_id is null then
    return new;
  end if;

  select pd.drop_date into as_of from public.prompt_drops pd where pd.id = new.drop_id;
  if as_of is null then return new; end if;

  select * into st from public.streaks where user_id = new.user_id;
  if st.user_id is null then return new; end if; -- signup creates the row; nothing to do otherwise

  first_day := coalesce(public.streak_window_start(new.user_id, as_of), as_of);

  select count(distinct pd.drop_date) into days_win
  from public.submissions s
  join public.prompt_drops pd on pd.id = s.drop_id
  where s.user_id = new.user_id and s.thumb_path is not null
    and pd.drop_date > as_of - win and pd.drop_date <= as_of;

  if not st.is_alive then
    -- Day-one immediate reward, backdated to the first shot of the run.
    update public.streaks set
      is_alive         = true,
      flame_started_on = first_day,
      days_alive       = (as_of - first_day) + 1,
      current_weeks    = (as_of - first_day) + 1,
      days_this_week   = days_win,
      shields          = smax,
      week_anchor      = first_day,
      last_active      = as_of,
      comeback_pending = false,
      updated_at       = now()
    where user_id = new.user_id;
  else
    -- Already lit: keep the window count and age current. Survival + shield
    -- regen stay at close, so a submit can only help, never break.
    update public.streaks set
      days_this_week = days_win,
      days_alive     = greatest(st.days_alive, (as_of - coalesce(st.flame_started_on, as_of)) + 1),
      current_weeks  = greatest(st.current_weeks, (as_of - coalesce(st.flame_started_on, as_of)) + 1),
      last_active    = greatest(coalesce(st.last_active, as_of), as_of),
      updated_at     = now()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_streak_touch on public.submissions;
create trigger trg_streak_touch
  after insert on public.submissions
  for each row execute function public.streak_touch_on_submit();

-- Backfill: relight streaks stuck dead by the old close-only behaviour — never
-- broken (comeback not armed) but with real activity in the window. Backdated to
-- the run's first day. Legitimately-broken streaks (comeback_pending) are left.
update public.streaks st set
  is_alive         = true,
  flame_started_on = public.streak_window_start(st.user_id, current_date),
  days_alive       = (current_date - public.streak_window_start(st.user_id, current_date)) + 1,
  current_weeks    = (current_date - public.streak_window_start(st.user_id, current_date)) + 1,
  shields          = public.cfg_int('streak_shield_max', 1),
  week_anchor      = public.streak_window_start(st.user_id, current_date),
  updated_at       = now()
where not st.is_alive
  and not st.comeback_pending
  and public.streak_window_start(st.user_id, current_date) is not null;
