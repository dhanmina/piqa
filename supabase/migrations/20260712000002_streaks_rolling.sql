-- Phase 4 · Step 1 — Streaks: the 4-of-7 rolling-week model (spec §10).
--
-- A streak survives if the user submitted on >= streak_min_days of the trailing
-- streak_window_days (default 4 of 7). Evaluated at EVERY close (daily): if the
-- rolling count falls below the threshold while the flame was alive, that's a
-- MISS — one shield is auto-consumed (flame lives) or, with no shield, the
-- streak breaks and a comeback is armed. The shield regenerates once per full
-- window while alive. A broken streak's first submission pays double XP once.
--
-- current_weeks = flame count (weeks the streak has survived), lights at the
-- first 4-of-7 and ticks up each full window maintained. days_this_week = the
-- rolling submission-day count (the 7 header dots). is_alive = flame lit (true
-- even while a shield is covering a sub-threshold day). All thresholds in config.

-- ---------------------------------------------------------------------------
-- Schema — additive, nullable-safe.
-- ---------------------------------------------------------------------------
alter table public.streaks
  add column if not exists is_alive    boolean not null default false,
  add column if not exists week_anchor date;

insert into public.config (key, value) values
  ('streak_window_days',   '7'),
  ('streak_min_days',      '4'),
  ('streak_shield_max',    '1'),
  ('streak_shield_regen',  '1'),
  ('comeback_multiplier',  '2')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- evaluate_streak(uid, as_of) — the whole rolling transition for one user on
-- one day. Internal: called only from close_day (SECURITY DEFINER), so it runs
-- as owner; no privilege is granted to authenticated.
-- ---------------------------------------------------------------------------
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
  new_weeks int;
  new_shields int;
  new_anchor date;
  new_comeback boolean;
begin
  select * into st from public.streaks where user_id = p_uid;
  if st.user_id is null then return; end if;

  -- Did they submit on the day being closed?
  did_today := exists (
    select 1 from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.user_id = p_uid and s.thumb_path is not null and pd.drop_date = p_as_of
  );

  -- Distinct submission-days inside the trailing window (…as_of-win+1 .. as_of).
  select count(distinct pd.drop_date) into days_win
  from public.submissions s
  join public.prompt_drops pd on pd.id = s.drop_id
  where s.user_id = p_uid and s.thumb_path is not null
    and pd.drop_date > p_as_of - win and pd.drop_date <= p_as_of;

  was_alive    := st.is_alive;
  new_alive    := was_alive;
  new_weeks    := st.current_weeks;
  new_shields  := st.shields;
  new_anchor   := st.week_anchor;
  new_comeback := st.comeback_pending;

  if days_win >= mind then
    new_alive := true;
    if not was_alive then
      -- Flame lights on the first 4-of-7.
      new_weeks  := greatest(st.current_weeks, 1);
      new_anchor := p_as_of;
    elsif st.week_anchor is not null and (p_as_of - st.week_anchor) >= win then
      -- A full window maintained → another week + shield regen.
      new_weeks   := st.current_weeks + 1;
      new_shields := least(st.shields + sregen, smax);
      new_anchor  := st.week_anchor + win;
    end if;
  else
    if was_alive then
      if st.shields > 0 then
        new_shields := st.shields - 1;   -- shield absorbs the miss
        new_alive   := true;             -- flame lives
      else
        new_alive    := false;           -- break
        new_weeks    := 0;
        new_anchor   := null;
        new_comeback := true;            -- arm the comeback double-XP
      end if;
    -- else: still building or already dead — nothing to break.
    end if;
  end if;

  update public.streaks
    set is_alive         = new_alive,
        current_weeks    = new_weeks,
        days_this_week   = days_win,
        shields          = new_shields,
        week_anchor      = new_anchor,
        comeback_pending = new_comeback,
        last_active      = case when did_today then p_as_of else st.last_active end,
        updated_at       = now()
    where user_id = p_uid;
end;
$$;

revoke execute on function public.evaluate_streak(uuid, date) from public, anon, authenticated;
grant  execute on function public.evaluate_streak(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- close_day — unchanged Bradley-Terry ranking; the streaks/XP tail now runs the
-- rolling model + comeback double-XP instead of a naive per-close increment.
-- ---------------------------------------------------------------------------
create or replace function public.close_day(p_drop uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ids uuid[];
  k int;
  wins double precision[];
  ncomp int[];
  nmat double precision[];
  s double precision[];
  news double precision[];
  bt double precision[];
  score double precision[];
  numer double precision;
  denom double precision;
  ln_sum double precision;
  gm double precision;
  mu double precision;
  cval double precision := public.cfg_num('bt_shrink_c', 5);
  gpct int := public.cfg_int('gallery_pct', 20);
  gmin int := public.cfg_int('gallery_min', 10);
  gmax int := public.cfg_int('gallery_max', 50);
  quorum int := public.cfg_int('quorum', 8);
  beta boolean := public.cfg_bool('beta_mode', true);
  beta_all_below int := public.cfg_int('beta_gallery_all_below', 15);
  xp_cap int := public.cfg_int('xp_daily_cap', 250);
  cb_mult int := public.cfg_int('comeback_multiplier', 2);
  gallery_n int;
  potd_id uuid;
  already_closed boolean;
  v record;
  su record;
  as_of_date date;
  drop_region text;
  wi int;
  li int;
  i int;
  j int;
  payload jsonb;
begin
  ids := array(
    select id from public.submissions
    where drop_id = p_drop and thumb_path is not null
    order by id
  );
  k := coalesce(array_length(ids, 1), 0);

  already_closed := exists (select 1 from public.galleries where drop_id = p_drop);

  update public.submissions
    set in_gallery = false, is_potd = false
    where drop_id = p_drop;

  if k = 0 then
    insert into public.galleries (drop_id, payload)
    values (p_drop, jsonb_build_object('drop_id', p_drop, 'photos', '[]'::jsonb))
    on conflict (drop_id) do update set payload = excluded.payload, created_at = now();
    update public.prompt_drops set status = 'revealed' where id = p_drop;
    return jsonb_build_object('ok', true, 'submissions', 0, 'gallery', 0, 'potd', null);
  end if;

  wins  := array_fill(0::double precision, array[k]);
  ncomp := array_fill(0, array[k]);
  nmat  := array_fill(0::double precision, array[k, k]);
  s     := array_fill(1::double precision, array[k]);

  for v in
    select winner_id, loser_id from public.votes where drop_id = p_drop
  loop
    wi := array_position(ids, v.winner_id);
    li := array_position(ids, v.loser_id);
    if wi is null or li is null then continue; end if;
    wins[wi]     := wins[wi] + 1;
    ncomp[wi]    := ncomp[wi] + 1;
    ncomp[li]    := ncomp[li] + 1;
    nmat[wi][li] := nmat[wi][li] + 1;
    nmat[li][wi] := nmat[li][wi] + 1;
  end loop;

  news := array_fill(1::double precision, array[k]);
  for iter in 1..60 loop
    for i in 1..k loop
      denom := 1.0 / (s[i] + 1.0);
      for j in 1..k loop
        if nmat[i][j] > 0 then
          denom := denom + nmat[i][j] / (s[i] + s[j]);
        end if;
      end loop;
      numer := wins[i] + 0.5;
      news[i] := numer / denom;
    end loop;
    ln_sum := 0;
    for i in 1..k loop ln_sum := ln_sum + ln(news[i]); end loop;
    gm := exp(ln_sum / k);
    for i in 1..k loop s[i] := news[i] / gm; end loop;
  end loop;

  bt := array_fill(0::double precision, array[k]);
  ln_sum := 0;
  for i in 1..k loop
    bt[i] := ln(s[i]);
    ln_sum := ln_sum + bt[i];
  end loop;
  mu := ln_sum / k;
  score := array_fill(0::double precision, array[k]);
  for i in 1..k loop
    score[i] := mu + (bt[i] - mu) * ncomp[i]::double precision / (ncomp[i] + cval);
  end loop;

  gallery_n := ceil(k * gpct / 100.0);
  gallery_n := greatest(gallery_n, gmin);
  gallery_n := least(gallery_n, gmax);
  gallery_n := least(gallery_n, k);
  if beta and k < beta_all_below then
    gallery_n := k;
  end if;

  with ranked as (
    select ids[idx] as id, score[idx] as sc,
           row_number() over (order by score[idx] desc, ncomp[idx] desc, ids[idx]) as rnk
    from generate_series(1, k) as gs(idx)
  )
  update public.submissions sub
    set bt_score = r.sc,
        in_gallery = (r.rnk <= gallery_n)
    from ranked r
    where sub.id = r.id;

  select id into potd_id from (
    select ids[idx] as id, score[idx] as sc, ncomp[idx] as nc,
           case when ncomp[idx] > 0 then wins[idx] / ncomp[idx] else 0 end as wr
    from generate_series(1, k) as gs(idx)
  ) t
  where nc >= quorum
  order by sc desc, nc desc, wr desc
  limit 1;

  if potd_id is null then
    select id into potd_id from (
      select ids[idx] as id, score[idx] as sc, ncomp[idx] as nc,
             case when ncomp[idx] > 0 then wins[idx] / ncomp[idx] else 0 end as wr
      from generate_series(1, k) as gs(idx)
    ) t
    order by sc desc, nc desc, wr desc
    limit 1;
  end if;

  update public.submissions set is_potd = true where id = potd_id;

  select jsonb_build_object(
           'drop_id', p_drop,
           'drop_date', pd.drop_date,
           'prompt', pr.text,
           'photos', coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'id', s2.id,
                 'thumb_path', s2.thumb_path,
                 'image_path', s2.image_path,
                 'user_id', s2.user_id,
                 'shooter', p2.username,
                 'hearts', s2.vote_count + s2.reaction_count,
                 'is_potd', s2.is_potd,
                 'bt_score', s2.bt_score,
                 'captured_at', s2.captured_at
               )
               order by s2.is_potd desc, s2.bt_score desc nulls last, s2.vote_count desc
             )
             from public.submissions s2
             join public.profiles p2 on p2.id = s2.user_id
             where s2.drop_id = p_drop and s2.in_gallery
           ), '[]'::jsonb)
         )
    into payload
  from public.prompt_drops pd
  join public.prompts pr on pr.id = pd.prompt_id
  where pd.id = p_drop;

  insert into public.galleries (drop_id, payload)
  values (p_drop, payload)
  on conflict (drop_id) do update set payload = excluded.payload, created_at = now();

  update public.prompt_drops set status = 'revealed' where id = p_drop;

  -- ---- streaks + XP (spec §10 · 4-of-7 rolling model) ---------------------
  -- Awarded once per drop: only on the FIRST close (galleries row didn't exist).
  if not already_closed then
    select drop_date, region into as_of_date, drop_region
      from public.prompt_drops where id = p_drop;

    -- XP per submitter; a pending comeback doubles the day's (capped) earn once.
    update public.profiles p
      set xp = p.xp + least(
          20
          + (case when s2.quick_draw then 10  else 0 end)
          + s2.vote_count * 2
          + (case when s2.in_gallery then 50  else 0 end)
          + (case when s2.is_potd    then 100 else 0 end),
          xp_cap
        ) * (case when st.comeback_pending then cb_mult else 1 end)
    from public.submissions s2
    join public.streaks st on st.user_id = s2.user_id
    where s2.drop_id = p_drop and s2.thumb_path is not null and s2.user_id = p.id;

    -- Comeback is a one-time welcome — clear it for everyone who submitted.
    update public.streaks st
      set comeback_pending = false, updated_at = now()
    from public.submissions s2
    where s2.drop_id = p_drop and s2.thumb_path is not null
      and s2.user_id = st.user_id and st.comeback_pending;

    -- Re-evaluate the rolling streak for every in-region user who is alive (to
    -- catch a miss), has lingering dots (to decay them), or submitted today (to
    -- extend/start). Dead users with no dots can't change, so they're skipped.
    for su in
      select pr.id as uid
      from public.profiles pr
      join public.streaks stk on stk.user_id = pr.id
      where pr.region = drop_region
        and (stk.is_alive
             or stk.days_this_week > 0
             or exists (
               select 1 from public.submissions s3
               where s3.drop_id = p_drop and s3.user_id = pr.id and s3.thumb_path is not null
             ))
    loop
      perform public.evaluate_streak(su.uid, as_of_date);
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'submissions', k,
    'gallery', gallery_n,
    'potd', potd_id,
    'awarded_xp', not already_closed
  );
end;
$$;

revoke execute on function public.close_day(uuid) from public, anon;
grant  execute on function public.close_day(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- get_home_state — add is_alive to the streak block so Today shows the real
-- flame state (a shielded sub-threshold day is still alive).
-- ---------------------------------------------------------------------------
create or replace function public.get_home_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  cur record;
  nxt timestamptz;
  s record;
  potd record;
  st public.streaks%rowtype;
  drop_json jsonb := null;
  sub_json jsonb := null;
  potd_json jsonb := null;
  streak_json jsonb := null;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  select pd.id, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at,
         p.text as prompt, p.category as category
    into cur
  from public.prompt_drops pd
  join public.prompts p on p.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  select pd.drops_at into nxt
  from public.prompt_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  if cur.id is not null then
    drop_json := jsonb_build_object(
      'id', cur.id,
      'prompt', cur.prompt,
      'category', cur.category,
      'drops_at', cur.drops_at,
      'submit_closes_at', cur.submit_closes_at,
      'voting_closes_at', cur.voting_closes_at,
      'is_live', (now() < cur.submit_closes_at)
    );

    select sub.id, sub.captured_at, sub.image_path, sub.thumb_path,
           sub.vote_count, sub.reaction_count, sub.quick_draw, sub.in_gallery, sub.is_potd
      into s
    from public.submissions sub
    where sub.drop_id = cur.id and sub.user_id = uid;

    if s.id is not null then
      sub_json := jsonb_build_object(
        'id', s.id,
        'captured_at', s.captured_at,
        'image_path', s.image_path,
        'thumb_path', s.thumb_path,
        'vote_count', s.vote_count,
        'reaction_count', s.reaction_count,
        'quick_draw', s.quick_draw,
        'in_gallery', s.in_gallery,
        'is_potd', s.is_potd
      );
    end if;
  end if;

  select s2.id, s2.drop_id, s2.thumb_path,
         (s2.vote_count + s2.reaction_count) as hearts,
         pr.username as shooter
    into potd
  from public.submissions s2
  join public.prompt_drops pd2 on pd2.id = s2.drop_id
  join public.profiles pr on pr.id = s2.user_id
  where pd2.region = prof.region and s2.is_potd = true
  order by pd2.drop_date desc
  limit 1;

  if potd.id is null then
    select s3.id, s3.drop_id, s3.thumb_path,
           (s3.vote_count + s3.reaction_count) as hearts,
           pr.username as shooter
      into potd
    from public.submissions s3
    join public.prompt_drops pd3 on pd3.id = s3.drop_id
    join public.profiles pr on pr.id = s3.user_id
    where pd3.region = prof.region
    order by pd3.drop_date desc, s3.vote_count desc
    limit 1;
  end if;

  if potd.id is not null then
    potd_json := jsonb_build_object(
      'submission_id', potd.id,
      'drop_id', potd.drop_id,
      'thumb_path', potd.thumb_path,
      'hearts', potd.hearts,
      'shooter', potd.shooter
    );
  end if;

  select * into st from public.streaks where user_id = uid;
  if st.user_id is not null then
    streak_json := jsonb_build_object(
      'current_weeks', st.current_weeks,
      'days_this_week', st.days_this_week,
      'shields', st.shields,
      'is_alive', st.is_alive
    );
  end if;

  return jsonb_build_object(
    'drop', drop_json,
    'next_drop_at', nxt,
    'submission', sub_json,
    'yesterday_potd', potd_json,
    'streak', streak_json
  );
end;
$$;

revoke execute on function public.get_home_state() from public, anon;
grant execute on function public.get_home_state() to authenticated;

-- ---------------------------------------------------------------------------
-- dev_status — surface is_alive for streak testing in the time-machine panel.
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
      'is_alive', coalesce(st.is_alive, false),
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
    'is_alive', coalesce(st.is_alive, false),
    'comeback_pending', coalesce(st.comeback_pending, false)
  );
end;
$$;
