-- Streak survival: the flame lives as long as you never miss 2 days in a row.
--
-- One clear, intuitive rule instead of a fuzzy 4-of-7 threshold: shoot at least
-- every other day and the flame stays lit; go dark two days back-to-back and it
-- breaks (a shield still covers the first break). Rolling window, no calendar
-- reset. Lighting, backdating, and the on-submit trigger from the previous
-- migrations are unchanged; only the survival test in evaluate_streak changes.

create or replace function public.evaluate_streak(p_uid uuid, p_as_of date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.streaks%rowtype;
  win    int := public.cfg_int('streak_window_days', 7);
  smax   int := public.cfg_int('streak_shield_max', 1);
  sregen int := public.cfg_int('streak_shield_regen', 1);
  did_today boolean;
  did_yesterday boolean;
  missed_two boolean;
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

  -- The whole survival rule: two blank days back-to-back ends the streak.
  did_yesterday := exists (
    select 1 from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.user_id = p_uid and s.thumb_path is not null and pd.drop_date = p_as_of - 1
  );
  missed_two := not did_today and not did_yesterday;

  -- Distinct submission-days in the window — display only (days_this_week/dots).
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
    -- The flame lights on the first submission of the run, backdated to its start.
    if did_today then
      new_alive   := true;
      new_started := coalesce(public.streak_window_start(p_uid, p_as_of), p_as_of);
      new_shields := smax;
    end if;
  else
    new_started := coalesce(st.flame_started_on, p_as_of);
    age := p_as_of - new_started;
    if missed_two then
      -- A shield covers the first 2-in-a-row gap; otherwise the flame breaks.
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
      -- Surviving: regen a shield once every full window of alive days.
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
