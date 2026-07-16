-- Streaks, phase 1 — the days-alive model (replaces the weeks/anchor framing).
--
-- The flame now lights on your FIRST submission and its number is how many days
-- it has been alive, resetting on a break. The rolling 4-of-7 stays the survival
-- rule under the hood (it can only fail once the 7-day window is full, so a new
-- user can't be broken early). This kills the cold-start dead zone and drops the
-- "weeks" unit that everyone misread as days.
--
-- Implementation note: days_alive is mirrored into current_weeks so every
-- existing reader (get_home_state, get_profile, StreakFlame) shows days with no
-- change to those functions. The honest last-7 calendar dots are phase 2.

alter table public.streaks
  add column if not exists flame_started_on date,
  add column if not exists days_alive int not null default 0;

-- Backfill currently-alive streaks so flame_started_on is never null for them
-- (week_anchor is the closest existing "started around" date).
update public.streaks
  set flame_started_on = coalesce(week_anchor, last_active, current_date),
      days_alive = greatest((current_date - coalesce(week_anchor, last_active, current_date)) + 1, 1),
      current_weeks = greatest((current_date - coalesce(week_anchor, last_active, current_date)) + 1, 1)
  where is_alive and flame_started_on is null;

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

  -- Did they submit on the day being closed?
  did_today := exists (
    select 1 from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.user_id = p_uid and s.thumb_path is not null and pd.drop_date = p_as_of
  );

  -- Distinct submission-days inside the trailing window.
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
    -- The flame lights on the first submission — day one, immediate reward.
    if did_today then
      new_alive   := true;
      new_started := p_as_of;
      new_shields := smax;         -- a fresh flame carries its shield
    end if;
  else
    -- Alive: heal a missing start date, then check survival.
    new_started := coalesce(st.flame_started_on, p_as_of);
    age := p_as_of - new_started;  -- days since it lit (0 on the light day)
    if age >= win and days_win < mind then
      -- Window full and the rhythm slipped: a shield covers it, else it breaks.
      if st.shields > 0 then
        new_shields := st.shields - 1;
        new_alive   := true;
      else
        new_alive    := false;
        new_started  := null;
        new_shields  := 0;
        new_comeback := true;      -- arm the comeback double-XP
      end if;
    elsif age > 0 and (age % win) = 0 then
      -- Surviving: regen a shield once every full window of alive days.
      new_shields := least(st.shields + sregen, smax);
    end if;
  end if;

  new_days := case when new_alive and new_started is not null then (p_as_of - new_started) + 1 else 0 end;

  update public.streaks
    set is_alive         = new_alive,
        flame_started_on = new_started,
        days_alive       = new_days,
        current_weeks    = new_days,   -- compat: every reader now shows days
        days_this_week   = days_win,
        shields          = new_shields,
        week_anchor      = new_started, -- kept populated, harmless
        comeback_pending = new_comeback,
        last_active      = case when did_today then p_as_of else st.last_active end,
        updated_at       = now()
    where user_id = p_uid;
end;
$$;

revoke execute on function public.evaluate_streak(uuid, date) from public, anon, authenticated;
grant  execute on function public.evaluate_streak(uuid, date) to service_role;
