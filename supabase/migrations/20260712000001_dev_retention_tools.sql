-- Phase 4 · Step 0 — DEV retention levers (spec §16 beta only).
--
-- The Phase 3 time machine can run a single day's cycle. Phase 4 is about
-- BEHAVIOUR OVER TIME (streaks, comeback, level frames, curator caps), so a
-- solo tester needs to simulate a WEEK of behaviour in minutes:
--
--   Advance day        → close today (seed votes + close_day), open tomorrow
--                         live+pristine, clone the seed field, optionally add MY
--                         submission so the day counts toward my streak.
--   Grant XP           → bump my xp to watch level frames / quiet-mode reveal.
--   Trigger streak break → kill the flame as if a week was missed with no shield.
--   Force comeback     → set the "first submission pays double XP once" flag.
--   Fill vote cap      → cast my votes up to vote_cap so the curate screen shows
--                         its clean "that's your 50" end-state.
--
-- Same safety latch as Phase 3: every function calls dev_guard() (raises unless
-- config.beta_mode) and is SECURITY DEFINER. Flip beta_mode off in prod → inert.
-- The real 4-of-7 streak math + comeback double-XP land in later Phase 4 steps;
-- these levers only set/inspect the state those steps will compute.

-- comeback_pending: set when a streak breaks (or forced), consumed by the first
-- submission's close for double XP. Additive + nullable-safe default.
alter table public.streaks
  add column if not exists comeback_pending boolean not null default false;

-- ---------------------------------------------------------------------------
-- Grant XP — raw (uncapped) bump to the CURRENT user, for level/frame testing.
-- ---------------------------------------------------------------------------
create or replace function public.dev_grant_xp(p_amount int default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  newxp int;
begin
  perform public.dev_guard();
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.profiles set xp = greatest(xp + p_amount, 0)
    where id = uid returning xp into newxp;
  return jsonb_build_object('ok', true, 'xp', newxp);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger streak break — flame dies as if a week was missed with no shield left.
-- ---------------------------------------------------------------------------
create or replace function public.dev_break_streak()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  perform public.dev_guard();
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.streaks
    set current_weeks = 0,
        days_this_week = 0,
        shields = 0,
        comeback_pending = false,
        last_active = (now() at time zone 'Asia/Manila')::date - 8,
        updated_at = now()
    where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Force comeback state — lapsed + flag set so the next submission pays double.
-- ---------------------------------------------------------------------------
create or replace function public.dev_force_comeback()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  perform public.dev_guard();
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.streaks
    set current_weeks = 0,
        days_this_week = 0,
        comeback_pending = true,
        last_active = (now() at time zone 'Asia/Manila')::date - 3,
        updated_at = now()
    where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fill vote cap — insert my picks up to vote_cap on the current drop so the
-- curate screen reaches its "that's your 50" end-state. Distinct non-owned
-- pairs; duplicate pairs are skipped (the voter+pair unique index).
-- ---------------------------------------------------------------------------
create or replace function public.dev_fill_vote_cap()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  did uuid;
  cap int := public.cfg_int('vote_cap', 50);
  have int;
  a_id uuid;
  b_id uuid;
  inserted int := 0;
  guard int := 0;
begin
  perform public.dev_guard();
  if uid is null then raise exception 'not_authenticated'; end if;
  did := public.dev_current_drop();
  if did is null then return jsonb_build_object('ok', false, 'reason', 'no_drop'); end if;

  select count(*) into have from public.votes where voter_id = uid and drop_id = did;

  while have + inserted < cap and guard < cap * 20 loop
    guard := guard + 1;
    select id into a_id from public.submissions
      where drop_id = did and user_id <> uid and thumb_path is not null
      order by random() limit 1;
    select id into b_id from public.submissions
      where drop_id = did and user_id <> uid and thumb_path is not null and id <> a_id
      order by random() limit 1;
    exit when a_id is null or b_id is null;
    begin
      insert into public.votes (drop_id, voter_id, winner_id, loser_id)
      values (did, uid, a_id, b_id);
      inserted := inserted + 1;
      update public.submissions set vote_count = vote_count + 1 where id = a_id;
    exception when unique_violation then
      null; -- already judged this pair; loop tries another
    end;
  end loop;

  return jsonb_build_object('ok', true, 'drop_id', did, 'my_votes', have + inserted, 'cap', cap);
end;
$$;

-- ---------------------------------------------------------------------------
-- Advance day — the streak-simulation workhorse. Closes the current live drop
-- (seed votes → close_day, so it produces a real gallery + XP), then opens the
-- NEXT calendar day's BETA drop live+pristine, clones the seed submission field
-- so the day is a full cycle, and (if p_i_submitted) adds MY submission so this
-- day counts toward my streak when it closes on the next advance.
-- ---------------------------------------------------------------------------
create or replace function public.dev_advance_day(p_i_submitted boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur uuid;
  cur_date date;
  next_date date;
  seed_drop uuid;
  chosen_prompt uuid;
  new_drop uuid;
  cloned int := 0;
begin
  perform public.dev_guard();
  if uid is null then raise exception 'not_authenticated'; end if;

  cur := public.dev_current_drop();

  -- 1. Close the current live day (unless already closed). Seed votes first so
  --    it yields a real gallery + PotD + XP, exactly like a lived day.
  if cur is not null and not exists (select 1 from public.galleries where drop_id = cur) then
    perform public.dev_seed_votes();   -- acts on dev_current_drop() = cur
    perform public.close_day(cur);
  end if;

  -- 2. Pick the next calendar date (skip past any date that already has a drop).
  select drop_date into cur_date from public.prompt_drops where id = cur;
  next_date := coalesce(cur_date, (now() at time zone 'Asia/Manila')::date) + 1;
  while exists (select 1 from public.prompt_drops where region = 'BETA' and drop_date = next_date) loop
    next_date := next_date + 1;
  end loop;

  select id into chosen_prompt from public.prompts order by used_at asc nulls first, random() limit 1;
  if chosen_prompt is null then
    return jsonb_build_object('ok', false, 'reason', 'no_prompts');
  end if;

  insert into public.prompt_drops
    (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (chosen_prompt, 'BETA', next_date, now(), now() + interval '2 hours', now() + interval '6 hours', 'live')
  returning id into new_drop;
  update public.prompts set used_at = next_date where id = chosen_prompt;

  -- 3. Clone the richest seed field onto the new day (house + seed accounts).
  select drop_id into seed_drop
  from public.submissions
  where thumb_path is not null and drop_id <> new_drop
  group by drop_id
  order by count(*) desc
  limit 1;

  if seed_drop is not null then
    insert into public.submissions (drop_id, user_id, image_path, thumb_path, captured_at, rating, quick_draw)
    select new_drop, s.user_id, s.image_path, s.thumb_path, now(),
           public.cfg_int('elo_start', 1000), false
    from public.submissions s
    where s.drop_id = seed_drop and s.thumb_path is not null and s.user_id <> uid
    on conflict (drop_id, user_id) do nothing;
    get diagnostics cloned = row_count;

    -- 4. My submission on the new live day, if I "shot" today. Reuses a seed
    --    image path (renders in the gallery once in_gallery is set at close;
    --    the point of this row is that the day counts toward my streak).
    if p_i_submitted then
      insert into public.submissions (drop_id, user_id, image_path, thumb_path, captured_at, rating, quick_draw)
      select new_drop, uid, s.image_path, s.thumb_path, now(),
             public.cfg_int('elo_start', 1000), true
      from public.submissions s
      where s.drop_id = seed_drop and s.thumb_path is not null and s.user_id <> uid
      limit 1
      on conflict (drop_id, user_id) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'drop_id', new_drop,
    'drop_date', next_date,
    'cloned', cloned,
    'i_submitted', p_i_submitted
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend dev_status with the retention state the panel now needs to show.
-- ---------------------------------------------------------------------------
create or replace function public.dev_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  did uuid;
  d record;
  st public.streaks%rowtype;
  my_xp int;
  potd_name text;
begin
  perform public.dev_guard();
  did := public.dev_current_drop();

  select * into st from public.streaks where user_id = uid;
  select xp into my_xp from public.profiles where id = uid;

  if did is null then
    return jsonb_build_object(
      'drop_id', null,
      'my_xp', my_xp,
      'streak_weeks', coalesce(st.current_weeks, 0),
      'days_this_week', coalesce(st.days_this_week, 0),
      'shields', coalesce(st.shields, 0),
      'comeback_pending', coalesce(st.comeback_pending, false)
    );
  end if;

  select pd.drop_date, pd.status, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at
    into d
  from public.prompt_drops pd where pd.id = did;

  select pr.username into potd_name
  from public.submissions s join public.profiles pr on pr.id = s.user_id
  where s.drop_id = did and s.is_potd limit 1;

  return jsonb_build_object(
    'drop_id', did,
    'drop_date', d.drop_date,
    'status', d.status,
    'drops_at', d.drops_at,
    'submit_closes_at', d.submit_closes_at,
    'voting_closes_at', d.voting_closes_at,
    'is_live', (now() >= d.drops_at and now() < d.submit_closes_at),
    'voting_open', (now() < d.voting_closes_at),
    'submissions', (select count(*) from public.submissions where drop_id = did and thumb_path is not null),
    'votes', (select count(*) from public.votes where drop_id = did),
    'in_gallery', (select count(*) from public.submissions where drop_id = did and in_gallery),
    'closed', exists (select 1 from public.galleries where drop_id = did),
    'potd_shooter', potd_name,
    'my_submitted', exists (
      select 1 from public.submissions
      where drop_id = did and user_id = uid and thumb_path is not null
    ),
    'my_votes', (select count(*) from public.votes where drop_id = did and voter_id = uid),
    'my_xp', my_xp,
    'streak_weeks', coalesce(st.current_weeks, 0),
    'days_this_week', coalesce(st.days_this_week, 0),
    'shields', coalesce(st.shields, 0),
    'comeback_pending', coalesce(st.comeback_pending, false)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — mirror the Phase 3 dev tools: authenticated (dev panel) + service.
-- ---------------------------------------------------------------------------
revoke execute on function public.dev_grant_xp(int)       from public, anon;
revoke execute on function public.dev_break_streak()      from public, anon;
revoke execute on function public.dev_force_comeback()    from public, anon;
revoke execute on function public.dev_fill_vote_cap()     from public, anon;
revoke execute on function public.dev_advance_day(boolean) from public, anon;

grant execute on function public.dev_grant_xp(int)        to authenticated, service_role;
grant execute on function public.dev_break_streak()       to authenticated, service_role;
grant execute on function public.dev_force_comeback()     to authenticated, service_role;
grant execute on function public.dev_fill_vote_cap()      to authenticated, service_role;
grant execute on function public.dev_advance_day(boolean) to authenticated, service_role;
