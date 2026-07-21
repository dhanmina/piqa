-- Phase 0B: rename prompts -> subjects, prompt_drops -> subject_drops (TABLES only).
-- The client never queries these tables directly (RPC-only), so this is a
-- server-only change. Columns (prompt_id, voter_id) are intentionally left as-is
-- (lower value, higher risk, inside functions). All 35 functions that referenced
-- the old table names are regenerated below with public.subjects / public.subject_drops.

alter table public.prompts rename to subjects;
alter table public.prompt_drops rename to subject_drops;

CREATE OR REPLACE FUNCTION public.dev_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  from public.subject_drops pd where pd.id = did;

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
$function$
;

CREATE OR REPLACE FUNCTION public.dev_advance_day(p_i_submitted boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  select drop_date into cur_date from public.subject_drops where id = cur;
  next_date := coalesce(cur_date, (now() at time zone 'Asia/Manila')::date) + 1;
  while exists (select 1 from public.subject_drops where region = 'BETA' and drop_date = next_date) loop
    next_date := next_date + 1;
  end loop;

  select id into chosen_prompt from public.subjects order by used_at asc nulls first, random() limit 1;
  if chosen_prompt is null then
    return jsonb_build_object('ok', false, 'reason', 'no_prompts');
  end if;

  insert into public.subject_drops
    (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (chosen_prompt, 'BETA', next_date, now(), now() + interval '2 hours', now() + interval '6 hours', 'live')
  returning id into new_drop;
  update public.subjects set used_at = next_date where id = chosen_prompt;

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
$function$
;

CREATE OR REPLACE FUNCTION public.evaluate_streak(p_uid uuid, p_as_of date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    join public.subject_drops pd on pd.id = s.drop_id
    where s.user_id = p_uid and s.thumb_path is not null and pd.drop_date = p_as_of
  );

  -- The whole survival rule: two blank days back-to-back ends the streak.
  did_yesterday := exists (
    select 1 from public.submissions s
    join public.subject_drops pd on pd.id = s.drop_id
    where s.user_id = p_uid and s.thumb_path is not null and pd.drop_date = p_as_of - 1
  );
  missed_two := not did_today and not did_yesterday;

  -- Distinct submission-days in the window — display only (days_this_week/dots).
  select count(distinct pd.drop_date) into days_win
  from public.submissions s
  join public.subject_drops pd on pd.id = s.drop_id
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_analytics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  totals jsonb;
  daily jsonb;
  crowns jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  totals := jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'submissions', (select count(*) from public.submissions where thumb_path is not null),
    'votes', (select count(*) from public.votes),
    'prompts', (select count(*) from public.subjects),
    'prompts_unused', (select count(*) from public.subjects where used_at is null),
    'pending_reports', (select count(distinct submission_id) from public.reports where status = 'pending')
  );

  -- last 14 drop days, submissions + votes per day (summed across regions)
  daily := coalesce((
    select jsonb_agg(jsonb_build_object('date', d.drop_date, 'submissions', d.subs, 'votes', d.votes) order by d.drop_date)
    from (
      select pd.drop_date,
             sum((select count(*) from public.submissions s where s.drop_id = pd.id and s.thumb_path is not null)) as subs,
             sum((select count(*) from public.votes v where v.drop_id = pd.id)) as votes
      from public.subject_drops pd
      group by pd.drop_date
      order by pd.drop_date desc
      limit 14
    ) d
  ), '[]'::jsonb);

  -- recent revealed days: who got the crown (or none)
  crowns := coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', c.drop_date, 'region', c.region, 'shooter', c.shooter, 'votes', c.votes
           ) order by c.drop_date desc)
    from (
      select pd.drop_date, pd.region,
             (select pr.username from public.submissions s join public.profiles pr on pr.id = s.user_id
              where s.drop_id = pd.id and s.is_potd limit 1) as shooter,
             (select count(*) from public.votes v where v.drop_id = pd.id) as votes
      from public.subject_drops pd
      where pd.status = 'revealed'
      order by pd.drop_date desc
      limit 10
    ) c
  ), '[]'::jsonb);

  return jsonb_build_object('totals', totals, 'daily', daily, 'crowns', crowns);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_delete_prompt(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  before jsonb;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if exists (select 1 from public.subject_drops d where d.prompt_id = p_id) then
    return jsonb_build_object('ok', false, 'reason', 'in_use');
  end if;

  select jsonb_build_object('text', text, 'category', category, 'is_sponsored', is_sponsored, 'seq', seq)
    into before
  from public.subjects where id = p_id;
  if before is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  delete from public.subjects where id = p_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values (uid, 'prompt.delete', 'prompt', p_id::text, before);

  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_latest_gallery()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  g record;
  use_fallback boolean := false;
  prompt_out text;
  photos jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  -- Real revealed gallery first.
  select pd.id, pd.drop_date, pd.drops_at, p.text as prompt
    into g
  from public.subject_drops pd
  join public.subjects p on p.id = pd.prompt_id
  where pd.region = prof.region
    and exists (select 1 from public.submissions s where s.drop_id = pd.id and s.in_gallery)
  order by pd.drop_date desc
  limit 1;

  if g.id is null then
    -- Fallback: most recent drop that has any (seed) submissions.
    select pd.id, pd.drop_date, pd.drops_at, p.text as prompt
      into g
    from public.subject_drops pd
    join public.subjects p on p.id = pd.prompt_id
    where pd.region = prof.region
      and exists (select 1 from public.submissions s where s.drop_id = pd.id)
    order by pd.drop_date desc
    limit 1;
    use_fallback := true;
  end if;

  if g.id is null then
    return jsonb_build_object('drop', null, 'photos', '[]'::jsonb, 'is_seed', false);
  end if;

  -- Never reveal the text of a prompt that hasn't dropped yet.
  prompt_out := case when g.drops_at <= now() then g.prompt else null end;

  if use_fallback then
    select coalesce(jsonb_agg(row order by rnk), '[]'::jsonb) into photos
    from (
      select jsonb_build_object(
               'id', s.id,
               'thumb_path', s.thumb_path,
               'hearts', s.vote_count + s.reaction_count,
               'shooter', pr.username,
               'is_potd', (row_number() over (order by s.vote_count desc, s.id)) = 1
             ) as row,
             row_number() over (order by s.vote_count desc, s.id) as rnk
      from public.submissions s
      join public.profiles pr on pr.id = s.user_id
      where s.drop_id = g.id
      order by s.vote_count desc, s.id
      limit 12
    ) q;
  else
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', s.id,
               'thumb_path', s.thumb_path,
               'hearts', s.vote_count + s.reaction_count,
               'shooter', pr.username,
               'is_potd', s.is_potd
             )
             order by s.is_potd desc, s.bt_score desc nulls last, s.vote_count desc
           ), '[]'::jsonb) into photos
    from public.submissions s
    join public.profiles pr on pr.id = s.user_id
    where s.drop_id = g.id and s.in_gallery;
  end if;

  return jsonb_build_object(
    'drop', jsonb_build_object('id', g.id, 'prompt', prompt_out, 'drop_date', g.drop_date),
    'photos', photos,
    'is_seed', use_fallback
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dev_current_drop()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.subject_drops
  where region = 'BETA'
  order by drop_date desc, drops_at desc
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.dev_force_drop()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  did uuid;
  chosen record;
begin
  perform public.dev_guard();

  select id into did from public.subject_drops where region = 'BETA' and drop_date = today_local;

  if did is null then
    select id into chosen from public.subjects order by used_at asc nulls first, random() limit 1;
    if chosen.id is null then
      return jsonb_build_object('ok', false, 'reason', 'no_prompts');
    end if;
    insert into public.subject_drops
      (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
    values
      (chosen.id, 'BETA', today_local, now(), now() + interval '2 hours', now() + interval '6 hours', 'live')
    returning id into did;
    update public.subjects set used_at = today_local where id = chosen.id;
  else
    update public.subject_drops
      set drops_at = now(),
          submit_closes_at = now() + interval '2 hours',
          voting_closes_at = now() + interval '6 hours',
          status = 'live'
      where id = did;
  end if;

  perform public.dev_reset_drop(did);

  return jsonb_build_object(
    'ok', true, 'drop_id', did,
    'submissions', (select count(*) from public.submissions where drop_id = did and thumb_path is not null)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.close_day(p_drop uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  potd_min int := public.cfg_int('potd_min_votes', 3);
  beta boolean := public.cfg_bool('beta_mode', true);
  beta_all_below int := public.cfg_int('beta_gallery_all_below', 15);
  xp_cap int := public.cfg_int('xp_daily_cap', 250);
  cb_mult int := public.cfg_int('comeback_multiplier', 2);
  gallery_n int;
  potd_id uuid;
  potd_user uuid;
  v_total int;
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
    set in_gallery = false, is_potd = false, gallery_rank = null
    where drop_id = p_drop;

  if k = 0 then
    insert into public.galleries (drop_id, payload)
    values (p_drop, jsonb_build_object('drop_id', p_drop, 'photos', '[]'::jsonb))
    on conflict (drop_id) do update set payload = excluded.payload, created_at = now();
    update public.subject_drops set status = 'revealed' where id = p_drop;
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
        in_gallery = (r.rnk <= gallery_n),
        gallery_rank = r.rnk
    from ranked r
    where sub.id = r.id;

  -- PotD only when the crowd actually voted. Below the floor of real votes
  -- (solo submitter, or nobody curated), there is no crown this day.
  potd_id := null;
  select count(*) into v_total from public.votes where drop_id = p_drop;

  if v_total >= potd_min then
    -- highest score meeting the full quorum
    select id into potd_id from (
      select ids[idx] as id, score[idx] as sc, ncomp[idx] as nc,
             case when ncomp[idx] > 0 then wins[idx] / ncomp[idx] else 0 end as wr
      from generate_series(1, k) as gs(idx)
    ) t
    where nc >= quorum
    order by sc desc, nc desc, wr desc
    limit 1;

    if potd_id is null then
      -- relax below quorum (small beta), but only among photos that were
      -- actually compared — a shot nobody voted on can never be crowned.
      select id into potd_id from (
        select ids[idx] as id, score[idx] as sc, ncomp[idx] as nc,
               case when ncomp[idx] > 0 then wins[idx] / ncomp[idx] else 0 end as wr
        from generate_series(1, k) as gs(idx)
      ) t
      where nc >= 1
      order by sc desc, nc desc, wr desc
      limit 1;
    end if;
  end if;

  update public.submissions set is_potd = true where id = potd_id;

  -- Winning a Photo of the Day unlocks the crown frame. Null-safe: no crown, no
  -- unlock. This is the ONLY writer of user_frames.
  select user_id into potd_user from public.submissions where id = potd_id;
  if potd_user is not null then
    insert into public.user_frames (user_id, frame_id)
    values (potd_user, 'crown')
    on conflict do nothing;
  end if;

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
  from public.subject_drops pd
  join public.subjects pr on pr.id = pd.prompt_id
  where pd.id = p_drop;

  insert into public.galleries (drop_id, payload)
  values (p_drop, payload)
  on conflict (drop_id) do update set payload = excluded.payload, created_at = now();

  update public.subject_drops set status = 'revealed' where id = p_drop;

  if not already_closed then
    select drop_date, region into as_of_date, drop_region
      from public.subject_drops where id = p_drop;

    update public.submissions s2
      set xp_awarded = least(
            20
            + (case when s2.quick_draw then 10  else 0 end)
            + s2.vote_count * 2
            + (case when s2.in_gallery then 50  else 0 end)
            + (case when s2.is_potd    then 100 else 0 end),
            xp_cap
          ) * (case when coalesce(st.comeback_pending, false) then cb_mult else 1 end)
      from public.streaks st
      where s2.drop_id = p_drop and s2.thumb_path is not null and st.user_id = s2.user_id;

    update public.profiles p
      set xp = p.xp + s2.xp_awarded
      from public.submissions s2
      where s2.drop_id = p_drop and s2.thumb_path is not null and s2.user_id = p.id;

    update public.streaks st
      set comeback_pending = false, updated_at = now()
    from public.submissions s2
    where s2.drop_id = p_drop and s2.thumb_path is not null
      and s2.user_id = st.user_id and st.comeback_pending;

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
$function$
;

CREATE OR REPLACE FUNCTION public.drop_prompt(p_region text DEFAULT 'PH'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  chosen record;
  drops_at timestamptz;
  submit_close timestamptz;
  voting_close timestamptz;
  new_drop_id uuid;
begin
  if exists (select 1 from public.subject_drops where region = p_region and drop_date = today_local) then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'exists');
  end if;

  select id, text into chosen
  from public.subjects
  order by used_at asc nulls first, seq asc nulls last, random()
  limit 1;

  if chosen.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_prompts');
  end if;

  drops_at     := ((today_local + time '06:00') at time zone 'Asia/Manila')
                  + make_interval(mins => floor(random() * 60)::int);
  submit_close := ((today_local + time '18:00') at time zone 'Asia/Manila');
  voting_close := ((today_local + time '19:00') at time zone 'Asia/Manila');

  insert into public.subject_drops
    (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (chosen.id, p_region, today_local, drops_at, submit_close, voting_close, 'scheduled')
  on conflict (region, drop_date) do nothing
  returning id into new_drop_id;

  update public.subjects set used_at = today_local where id = chosen.id;

  return jsonb_build_object('ok', true, 'created', true, 'drop_id', new_drop_id, 'drops_at', drops_at);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.close_due_drops()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d record;
  n int := 0;
begin
  for d in
    select id from public.subject_drops
    where voting_closes_at <= now() and status <> 'revealed'
    order by voting_closes_at asc
  loop
    perform public.close_day(d.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'closed', n);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dev_reset_day()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  did uuid;
begin
  perform public.dev_guard();
  did := public.dev_current_drop();
  if did is null then
    return jsonb_build_object('ok', false, 'reason', 'no_drop');
  end if;
  perform public.dev_reset_drop(did);
  update public.subject_drops
    set status = 'live'
    where id = did and voting_closes_at > now();
  return jsonb_build_object('ok', true, 'drop_id', did);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.decorate_photos(p_photos jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(
           t.ph || jsonb_build_object(
             'frame_id',   public.photo_frame(pd.drop_date),
             'day_number', pd.day_number,
             'status',     public.photo_status(s.is_potd, s.gallery_rank)
           )
           order by t.ord
         ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) with ordinality as t(ph, ord)
  left join public.submissions   s  on s.id  = (t.ph ->> 'id')::uuid
  left join public.subject_drops  pd on pd.id = s.drop_id;
$function$
;

CREATE OR REPLACE FUNCTION public.is_live_drop_thumb(object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.submissions s
    join public.subject_drops pd on pd.id = s.drop_id
    where s.thumb_path = object_name
      and now() >= pd.drops_at
      and now() < pd.voting_closes_at
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_profile(p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  target uuid;
  prof public.profiles%rowtype;
  st public.streaks%rowtype;
  galleries int;
  crowns int;
  hearts int;
  wins jsonb;
  owned jsonb;
  badges jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  target := coalesce(p_user, me);

  select * into prof from public.profiles where id = target;
  if prof.id is null then
    return jsonb_build_object('found', false);
  end if;

  select * into st from public.streaks where user_id = target;
  select count(*) into galleries from public.submissions where user_id = target and in_gallery;
  select count(*) into crowns   from public.submissions where user_id = target and is_potd;
  select coalesce(sum(vote_count + reaction_count), 0) into hearts
    from public.submissions where user_id = target;

  select coalesce(jsonb_agg(
           jsonb_build_object('id', id, 'thumb_path', thumb_path, 'image_path', image_path,
                              'is_potd', is_potd, 'user_id', target, 'drop_date', dd)
           order by dd desc
         ), '[]'::jsonb)
    into wins
  from (
    select s.id, s.thumb_path, s.image_path, s.is_potd, pd.drop_date as dd
    from public.submissions s
    join public.subject_drops pd on pd.id = s.drop_id
    where s.user_id = target and s.in_gallery
    order by pd.drop_date desc
    limit 24
  ) w;

  -- Only the viewer's own unlocks — you never see what frames someone else owns,
  -- just the one they have equipped.
  select coalesce(jsonb_agg(frame_id), '[]'::jsonb) into owned
  from public.user_frames where user_id = me;

  -- User badges (empty array if none).
  select coalesce(jsonb_agg(ub.badge_type order by ub.earned_at), '[]'::jsonb) into badges
  from public.user_badges ub
  where ub.user_id = target;

  return jsonb_build_object(
    'found', true,
    'id', target,
    'username', prof.username,
    'avatar_url', prof.avatar_url,
    'xp', prof.xp,
    'galleries', galleries,
    'streak_weeks', coalesce(st.current_weeks, 0),
    'hearts', hearts,
    'crowns', crowns,
    'wins', public.decorate_photos(public.filter_public_photos(wins, me)),
    'equipped_frame', prof.equipped_frame,
    'owned_frames', owned,
    'badges', badges,
    'is_self', target = me,
    'is_following', exists (select 1 from public.follows where follower_id = me and followee_id = target)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_home_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  cur record;
  nxt timestamptz;
  s record;
  potd record;
  st public.streaks%rowtype;
  latest_rev record;
  res record;
  drop_json jsonb := null;
  sub_json jsonb := null;
  potd_json jsonb := null;
  top_10_json jsonb := null;
  streak_json jsonb := null;
  result_json jsonb := null;
  top_drop uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  -- Current live drop (between drop and voting close)
  select pd.id, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at, pd.day_number,
         p.text as prompt, p.category as category
    into cur
  from public.subject_drops pd
  join public.subjects p on p.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  -- Next scheduled drop
  select pd.drops_at into nxt
  from public.subject_drops pd
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
      'day_number', cur.day_number,
      'is_live', (now() < cur.submit_closes_at)
    );

    select sub.id, sub.captured_at, sub.image_path, sub.thumb_path,
           sub.vote_count, sub.reaction_count, sub.quick_draw, sub.in_gallery,
           sub.is_potd, sub.gallery_rank
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
        'is_potd', s.is_potd,
        'status', public.photo_status(s.is_potd, s.gallery_rank),
        'day_number', cur.day_number
      );
    end if;
  end if;

  -- Yesterday's POTD: only from revealed drops where a POTD was crowned
  -- (< 3 submissions = no voting = no crown = null here).
  select s2.id, s2.drop_id, s2.thumb_path, s2.is_potd, s2.gallery_rank,
         pd2.day_number,
         (s2.vote_count + s2.reaction_count) as hearts,
         pr.username as shooter, pr.equipped_frame as frame
    into potd
  from public.submissions s2
  join public.subject_drops pd2 on pd2.id = s2.drop_id
  join public.profiles pr on pr.id = s2.user_id
  where pd2.region = prof.region
    and pd2.status = 'revealed'
    and s2.is_potd = true
  order by pd2.drop_date desc
  limit 1;

  if potd.id is not null then
    potd_json := jsonb_build_object(
      'submission_id', potd.id,
      'drop_id', potd.drop_id,
      'thumb_path', potd.thumb_path,
      'hearts', potd.hearts,
      'shooter', potd.shooter,
      'equipped_frame', potd.frame,
      'day_number', potd.day_number,
      'status', public.photo_status(potd.is_potd, potd.gallery_rank)
    );
  end if;

  -- Top 10: when no POTD crowned (< 3 submissions, no votes), return the
  -- top 10 submissions from the most recent drop with submissions.
  if potd.id is null then
    if cur.id is not null then
      top_drop := cur.id;
    else
      select pd3.id into top_drop
      from public.subject_drops pd3
      where pd3.region = prof.region and pd3.status = 'revealed'
      order by pd3.drop_date desc limit 1;
    end if;

    if top_drop is not null then
      select coalesce(jsonb_agg(t order by t.rnk), '[]'::jsonb)
        into top_10_json
      from (
        select jsonb_build_object(
                 'submission_id', s3.id,
                 'thumb_path', s3.thumb_path,
                 'hearts', (s3.vote_count + s3.reaction_count),
                 'shooter', pr2.username,
                 'equipped_frame', pr2.equipped_frame,
                 'rank', row_number() over (order by s3.vote_count desc, s3.created_at asc)
               ) as t,
               row_number() over (order by s3.vote_count desc, s3.created_at asc) as rnk
        from public.submissions s3
        join public.profiles pr2 on pr2.id = s3.user_id
        where s3.drop_id = top_drop and s3.thumb_path is not null
        order by s3.vote_count desc, s3.created_at asc
        limit 10
      ) q;
    end if;
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

  -- Latest revealed drop for the user's result
  select pd4.id as drop_id, pd4.drop_date, pd4.day_number
    into latest_rev
  from public.subject_drops pd4
  where pd4.region = prof.region and pd4.status = 'revealed'
  order by pd4.drop_date desc
  limit 1;

  if latest_rev.drop_id is not null then
    select sub.thumb_path, sub.image_path,
           (sub.vote_count + sub.reaction_count) as hearts,
           sub.in_gallery, sub.is_potd, sub.gallery_rank, sub.xp_awarded
      into res
    from public.submissions sub
    where sub.drop_id = latest_rev.drop_id and sub.user_id = uid and sub.thumb_path is not null;

    if res.thumb_path is not null then
      result_json := jsonb_build_object(
        'drop_id', latest_rev.drop_id,
        'drop_date', latest_rev.drop_date,
        'day_number', latest_rev.day_number,
        'thumb_path', res.thumb_path,
        'hearts', res.hearts,
        'in_gallery', res.in_gallery,
        'is_potd', res.is_potd,
        'status', public.photo_status(res.is_potd, res.gallery_rank),
        'xp_awarded', res.xp_awarded
      );
    end if;
  end if;

  return jsonb_build_object(
    'drop', drop_json,
    'next_drop_at', nxt,
    'submission', sub_json,
    'yesterday_potd', potd_json,
    'top_10', top_10_json,
    'streak', streak_json,
    'xp', prof.xp,
    'equipped_frame', prof.equipped_frame,
    'last_result', result_json
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dev_seed_submissions(p_count integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  did uuid;
  mark_gallery boolean;
  pool_cnt int;
  seeded int := 0;
begin
  perform public.dev_guard();

  select id into did
  from public.subject_drops
  where region = 'BETA' and drop_date = today_local;

  if did is null then
    return jsonb_build_object('ok', false, 'reason', 'no drop — Force drop first');
  end if;

  -- If any signable (in_gallery) object exists, reuse those and leave the seeded
  -- rows out of the gallery; otherwise reuse anything and mark them in_gallery so
  -- their thumbs can be signed during curation.
  select not exists (
    select 1 from public.submissions where thumb_path is not null and in_gallery
  ) into mark_gallery;

  select count(*) into pool_cnt from (
    select distinct image_path, thumb_path
    from public.submissions
    where thumb_path is not null and (mark_gallery or in_gallery)
  ) q;

  if pool_cnt = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no uploaded photos to reuse');
  end if;

  with pool as (
    select image_path, thumb_path, row_number() over (order by thumb_path) as rn
    from (
      select distinct image_path, thumb_path
      from public.submissions
      where thumb_path is not null and (mark_gallery or in_gallery)
    ) d
  ),
  houses as (
    select pr.id as uid, row_number() over (order by pr.id) as hn
    from public.profiles pr
    join auth.users u on u.id = pr.id
    where u.email like '%@joinpiqa.com'
      and not exists (
        select 1 from public.submissions s where s.drop_id = did and s.user_id = pr.id
      )
    order by pr.id
    limit p_count
  )
  insert into public.submissions
    (drop_id, user_id, image_path, thumb_path, captured_at, quick_draw, in_gallery)
  select did, h.uid, p.image_path, p.thumb_path, now(), false, mark_gallery
  from houses h
  join pool p on p.rn = ((h.hn - 1) % pool_cnt) + 1
  on conflict (drop_id, user_id) do nothing;

  get diagnostics seeded = row_count;

  return jsonb_build_object(
    'ok', true,
    'drop_id', did,
    'seeded', seeded,
    'submissions', (select count(*) from public.submissions where drop_id = did and thumb_path is not null)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_following_gallery()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  photos jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select coalesce(jsonb_agg(row order by dd desc, potd desc, hearts desc), '[]'::jsonb)
    into photos
  from (
    select jsonb_build_object(
             'id', s.id,
             'thumb_path', s.thumb_path,
             'image_path', s.image_path,
             'user_id', s.user_id,
             'shooter', pr.username,
             'hearts', s.vote_count + s.reaction_count,
             'is_potd', s.is_potd,
             'captured_at', s.captured_at,
             'drop_date', pd.drop_date
           ) as row,
           pd.drop_date as dd, s.is_potd as potd, (s.vote_count + s.reaction_count) as hearts
    from public.submissions s
    join public.subject_drops pd on pd.id = s.drop_id
    join public.profiles pr on pr.id = s.user_id
    where s.in_gallery
      and pd.drop_date >= current_date - 7
      and s.user_id in (select followee_id from public.follows where follower_id = me)
    order by pd.drop_date desc, s.is_potd desc, (s.vote_count + s.reaction_count) desc
    limit 60
  ) q;

  return jsonb_build_object(
    'photos', public.decorate_photos(public.filter_public_photos(photos, me))
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_matchup()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  d record;
  cap int := public.cfg_int('vote_cap', 50);
  set_size int := public.cfg_int('votes_per_set', 10);
  photo_cap int := public.cfg_int('curator_photo_cap', 2);
  cast_today int;
  remaining int;
  pairs jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  select pd.id, pd.voting_closes_at, pr.text as prompt
    into d
  from public.subject_drops pd
  join public.subjects pr on pr.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  if d.id is null then
    return jsonb_build_object('drop_id', null, 'prompt', null, 'remaining', 0, 'capped', false, 'pairs', '[]'::jsonb);
  end if;

  select count(*) into cast_today
  from public.votes where voter_id = uid and drop_id = d.id;

  remaining := greatest(cap - cast_today, 0);
  if remaining <= 0 then
    return jsonb_build_object('drop_id', d.id, 'prompt', d.prompt, 'remaining', 0, 'capped', true, 'pairs', '[]'::jsonb);
  end if;

  with seen as (
    -- How many times I've already judged each photo (as winner or loser).
    select photo_id, count(*) as n
    from (
      select winner_id as photo_id from public.votes where voter_id = uid and drop_id = d.id
      union all
      select loser_id  as photo_id from public.votes where voter_id = uid and drop_id = d.id
    ) t
    group by photo_id
  ),
  cand as (
    select s.id, s.thumb_path, s.rating, s.vote_count, coalesce(sn.n, 0) as my_seen
    from public.submissions s
    left join seen sn on sn.photo_id = s.id
    where s.drop_id = d.id
      and s.user_id <> uid
      and s.thumb_path is not null
      and coalesce(sn.n, 0) < photo_cap        -- stop showing me photos I've seen enough
  ),
  pool as (
    select *, row_number() over (order by my_seen asc, vote_count asc, random()) as expo
    from cand                                   -- least-seen-by-me first, for variety
  ),
  banded as (
    select * from pool where expo <= 40
  ),
  ordered as (
    select *, row_number() over (order by rating asc, random()) as rn
    from banded
  ),
  raw_pairs as (
    select a.id as a_id, a.thumb_path as a_thumb,
           b.id as b_id, b.thumb_path as b_thumb
    from ordered a
    join ordered b on b.rn = a.rn + 1 and (a.rn % 2) = 1
  ),
  fresh as (
    select rp.*
    from raw_pairs rp
    where not exists (
      select 1 from public.votes v
      where v.voter_id = uid
        and least(v.winner_id, v.loser_id)    = least(rp.a_id, rp.b_id)
        and greatest(v.winner_id, v.loser_id) = greatest(rp.a_id, rp.b_id)
    )
    order by random()
    limit least(set_size, remaining)
  )
  select coalesce(jsonb_agg(
           -- Randomly assign top/bottom so position is strength-neutral.
           case when random() < 0.5 then
             jsonb_build_object(
               'a', jsonb_build_object('id', a_id, 'thumb_path', a_thumb),
               'b', jsonb_build_object('id', b_id, 'thumb_path', b_thumb)
             )
           else
             jsonb_build_object(
               'a', jsonb_build_object('id', b_id, 'thumb_path', b_thumb),
               'b', jsonb_build_object('id', a_id, 'thumb_path', a_thumb)
             )
           end
         ), '[]'::jsonb)
    into pairs
  from fresh;

  return jsonb_build_object(
    'drop_id', d.id,
    'prompt', d.prompt,
    'remaining', remaining,
    'capped', false,
    'pairs', pairs
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.streak_window_start(p_uid uuid, p_as_of date)
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select min(pd.drop_date)
  from public.submissions s
  join public.subject_drops pd on pd.id = s.drop_id
  where s.user_id = p_uid
    and s.thumb_path is not null
    and pd.drop_date > p_as_of - public.cfg_int('streak_window_days', 7)
    and pd.drop_date <= p_as_of;
$function$
;

CREATE OR REPLACE FUNCTION public.streak_touch_on_submit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select pd.drop_date into as_of from public.subject_drops pd where pd.id = new.drop_id;
  if as_of is null then return new; end if;

  select * into st from public.streaks where user_id = new.user_id;
  if st.user_id is null then return new; end if; -- signup creates the row; nothing to do otherwise

  first_day := coalesce(public.streak_window_start(new.user_id, as_of), as_of);

  select count(distinct pd.drop_date) into days_win
  from public.submissions s
  join public.subject_drops pd on pd.id = s.drop_id
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_close_day(p_drop uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  before_status text;
  res jsonb;
begin
  if not public.is_admin(uid) then
    raise exception 'not_authorized';
  end if;
  select status into before_status from public.subject_drops where id = p_drop;
  res := public.close_day(p_drop);
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'drop.close', 'prompt_drop', p_drop::text, jsonb_build_object('status', before_status), res);
  return res;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.grant_event_frame_on_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  fr text;
begin
  select public.photo_frame(pd.drop_date) into fr
  from public.subject_drops pd
  where pd.id = new.drop_id;

  -- Only real event frames unlock (default is everyone's base, never "earned").
  if fr is not null and fr <> 'default' then
    insert into public.user_frames (user_id, frame_id)
    values (new.user_id, fr)
    on conflict do nothing;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_gallery(p_drop uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  g record;
  payload jsonb;
  cur_id uuid;
  is_seed boolean := false;
  past jsonb;
  nxt timestamptz;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into prof from public.profiles where id = uid;

  if p_drop is not null then
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.subject_drops pd on pd.id = ga.drop_id
    where ga.drop_id = p_drop and pd.region = prof.region;
    if g.drop_id is not null then payload := g.payload; end if;
  else
    -- latest materialized gallery for my region
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.subject_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
    order by pd.drop_date desc
    limit 1;
    if g.drop_id is not null then payload := g.payload; end if;
  end if;

  -- Seed fallback: no materialized gallery yet — show the most recent
  -- REVEALED drop's submissions so the tab is never blank. Never pick
  -- an unrevealed drop: that would leak the Photo of the Day crown
  -- before voting ends.
  if payload is null then
    select pd.id, pd.drop_date,
           case when pd.drops_at <= now() then pr.text else null end as prompt
      into g
    from public.subject_drops pd
    join public.subjects pr on pr.id = pd.prompt_id
    where pd.region = prof.region
      and pd.status = 'revealed'
      and exists (select 1 from public.submissions s where s.drop_id = pd.id and s.thumb_path is not null)
    order by pd.drop_date desc
    limit 1;

    if g.id is null then
      return jsonb_build_object('drop', null, 'photos', '[]'::jsonb, 'is_seed', false,
                                'past', '[]'::jsonb, 'next_drop_at', null);
    end if;

    is_seed := true;
    payload := jsonb_build_object(
      'drop_id', g.id,
      'drop_date', g.drop_date,
      'prompt', g.prompt,
      'photos', coalesce((
        select jsonb_agg(obj order by rnk)
        from (
          select jsonb_build_object(
                   'id', s.id, 'thumb_path', s.thumb_path, 'image_path', s.image_path,
                   'user_id', s.user_id, 'shooter', pr.username,
                   'hearts', s.vote_count + s.reaction_count,
                   'is_potd', s.is_potd,
                   'bt_score', s.bt_score, 'captured_at', s.captured_at
                 ) as obj,
                 row_number() over (order by s.bt_score desc nulls last, s.vote_count desc, s.id) as rnk
          from public.submissions s
          join public.profiles pr on pr.id = s.user_id
          where s.drop_id = g.id and s.thumb_path is not null
          order by s.bt_score desc nulls last, s.vote_count desc, s.id
          limit 24
        ) q
      ), '[]'::jsonb)
    );
  end if;

  -- Past galleries (immutable back-issues) for date paging — summaries only.
  cur_id := (payload ->> 'drop_id')::uuid;
  select coalesce(jsonb_agg(
           jsonb_build_object('drop_id', t.drop_id, 'drop_date', t.drop_date, 'prompt', t.prompt)
           order by t.drop_date desc
         ), '[]'::jsonb)
    into past
  from (
    select ga.drop_id, pd.drop_date, (ga.payload ->> 'prompt') as prompt
    from public.galleries ga
    join public.subject_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
      and ga.drop_id <> cur_id
    order by pd.drop_date desc
    limit 30
  ) t;

  -- Live "what's happening now" teaser.
  select pd.drops_at into nxt
  from public.subject_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  return jsonb_build_object(
    'drop', jsonb_build_object(
      'id', payload ->> 'drop_id',
      'prompt', payload ->> 'prompt',
      'drop_date', payload ->> 'drop_date'
    ),
    'photos', payload -> 'photos',
    'is_seed', is_seed,
    'past', past,
    'next_drop_at', nxt
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_drops(p_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(row order by (row->>'drop_date') desc, row->>'region')
    from (
      select jsonb_build_object(
               'id', pd.id,
               'region', pd.region,
               'drop_date', pd.drop_date,
               'drops_at', pd.drops_at,
               'submit_closes_at', pd.submit_closes_at,
               'voting_closes_at', pd.voting_closes_at,
               'status', pd.status,
               'prompt_id', pd.prompt_id,
               'prompt_text', pr.text,
               'category', pr.category,
               'is_sponsored', pr.is_sponsored,
               'submissions', (select count(*) from public.submissions s where s.drop_id = pd.id and s.thumb_path is not null),
               'votes', (select count(*) from public.votes v where v.drop_id = pd.id),
               'revealed', exists (select 1 from public.galleries g where g.drop_id = pd.id)
             ) as row
      from public.subject_drops pd
      join public.subjects pr on pr.id = pd.prompt_id
      order by pd.drop_date desc, pd.region
      limit greatest(p_limit, 1)
    ) q
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_next_prompt(p_region text DEFAULT 'PH'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  chosen record;
  today_local date := (now() at time zone 'Asia/Manila')::date;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  if exists (select 1 from public.subject_drops where region = p_region and drop_date = today_local) then
    return jsonb_build_object('has_today', true, 'prompt', null);
  end if;
  select id, text, category into chosen
  from public.subjects
  order by used_at asc nulls first, seq asc nulls last, random()
  limit 1;
  if chosen.id is null then
    return jsonb_build_object('has_today', false, 'prompt', null);
  end if;
  return jsonb_build_object(
    'has_today', false,
    'prompt', jsonb_build_object('id', chosen.id, 'text', chosen.text, 'category', chosen.category)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_drop_times(p_drop uuid, p_drops_at timestamp with time zone, p_submit_closes_at timestamp with time zone, p_voting_closes_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  before jsonb;
begin
  if not public.is_admin(uid) then
    raise exception 'not_authorized';
  end if;
  if exists (select 1 from public.galleries where drop_id = p_drop) then
    return jsonb_build_object('ok', false, 'reason', 'already_revealed');
  end if;
  if not (p_drops_at < p_submit_closes_at and p_submit_closes_at <= p_voting_closes_at) then
    return jsonb_build_object('ok', false, 'reason', 'bad_order');
  end if;
  select jsonb_build_object(
           'drops_at', drops_at, 'submit_closes_at', submit_closes_at, 'voting_closes_at', voting_closes_at
         ) into before
  from public.subject_drops where id = p_drop;

  update public.subject_drops
    set drops_at = p_drops_at, submit_closes_at = p_submit_closes_at, voting_closes_at = p_voting_closes_at
    where id = p_drop;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'drop.reschedule', 'prompt_drop', p_drop::text, before,
          jsonb_build_object('drops_at', p_drops_at, 'submit_closes_at', p_submit_closes_at, 'voting_closes_at', p_voting_closes_at));

  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_prompts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'id', p.id,
               'text', p.text,
               'category', p.category,
               'is_sponsored', p.is_sponsored,
               'seq', p.seq,
               'used_at', p.used_at,
               'created_at', p.created_at,
               'in_use', exists (select 1 from public.subject_drops d where d.prompt_id = p.id)
             )
             order by (p.used_at is not null), p.seq asc nulls last, p.created_at
           )
    from public.subjects p
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_create_prompt(p_text text, p_category text, p_is_sponsored boolean DEFAULT false, p_seq integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  nid uuid;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if p_text is null or char_length(trim(p_text)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_text');
  end if;
  if p_category not in ('object', 'color', 'light', 'pov', 'emotion', 'absurd') then
    return jsonb_build_object('ok', false, 'reason', 'bad_category');
  end if;

  insert into public.subjects (text, category, is_sponsored, seq)
  values (trim(p_text), p_category, coalesce(p_is_sponsored, false), p_seq)
  returning id into nid;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (uid, 'prompt.create', 'prompt', nid::text,
          jsonb_build_object('text', trim(p_text), 'category', p_category, 'is_sponsored', coalesce(p_is_sponsored, false), 'seq', p_seq));

  return jsonb_build_object('ok', true, 'id', nid);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_prompt(p_id uuid, p_text text, p_category text, p_is_sponsored boolean, p_seq integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  before jsonb;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if p_text is null or char_length(trim(p_text)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_text');
  end if;
  if p_category not in ('object', 'color', 'light', 'pov', 'emotion', 'absurd') then
    return jsonb_build_object('ok', false, 'reason', 'bad_category');
  end if;

  select jsonb_build_object('text', text, 'category', category, 'is_sponsored', is_sponsored, 'seq', seq)
    into before
  from public.subjects where id = p_id;
  if before is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.subjects
    set text = trim(p_text), category = p_category, is_sponsored = coalesce(p_is_sponsored, false), seq = p_seq
    where id = p_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'prompt.update', 'prompt', p_id::text, before,
          jsonb_build_object('text', trim(p_text), 'category', p_category, 'is_sponsored', coalesce(p_is_sponsored, false), 'seq', p_seq));

  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_reports()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  threshold int := public.cfg_int('reports_quarantine_at', 3);
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(
             row order by (row->>'quarantined')::boolean desc, (row->>'reporters')::int desc, row->>'latest' desc
           )
    from (
      select jsonb_build_object(
               'submission_id', s.id,
               'thumb_path', s.thumb_path,
               'image_path', s.image_path,
               'shooter', pr.username,
               'shooter_id', s.user_id,
               'drop_date', pd.drop_date,
               'quarantined', coalesce(s.quarantined, false),
               'in_gallery', s.in_gallery,
               'reporters', (select count(distinct r2.user_id) from public.reports r2 where r2.submission_id = s.id),
               'reasons', (
                 select jsonb_object_agg(x.reason, x.c)
                 from (select reason, count(*) c from public.reports r3 where r3.submission_id = s.id group by reason) x
               ),
               'latest', (select max(r4.created_at) from public.reports r4 where r4.submission_id = s.id),
               'threshold', threshold
             ) as row
      from public.submissions s
      join public.profiles pr on pr.id = s.user_id
      join public.subject_drops pd on pd.id = s.drop_id
      where exists (select 1 from public.reports r where r.submission_id = s.id and r.status = 'pending')
    ) q
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_start_drop(p_drop uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  before jsonb;
  new_submit timestamptz;
  new_voting timestamptz;
begin
  if not public.is_admin(uid) then
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
           'drops_at', drops_at,
           'submit_closes_at', submit_closes_at,
           'voting_closes_at', voting_closes_at,
           'status', status
         )
  into before
  from public.subject_drops
  where id = p_drop;

  if before is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if before->>'status' <> 'scheduled' then
    return jsonb_build_object('ok', false, 'reason', 'not_scheduled');
  end if;

  new_submit := now() + interval '5 hours';
  new_voting := now() + interval '13 hours';

  update public.subject_drops
     set drops_at         = now(),
         submit_closes_at = new_submit,
         voting_closes_at = new_voting,
         status           = 'live'
   where id = p_drop;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'drop.start', 'prompt_drop', p_drop::text, before,
          jsonb_build_object('drops_at', now(), 'submit_closes_at', new_submit, 'voting_closes_at', new_voting, 'status', 'live'));

  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_engagement()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  daily jsonb;
  totals jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  -- Last 14 drop days: unique submitters, unique voters, participation rate
  daily := coalesce((
    select jsonb_agg(row order by (row->>'date'))
    from (
      select jsonb_build_object(
               'date', pd.drop_date,
               'submissions', coalesce(sub_stats.cnt, 0),
               'voters', coalesce(vote_stats.cnt, 0),
               'unique_submitters', coalesce(sub_stats.users, 0),
               'unique_voters', coalesce(vote_stats.users, 0),
               'participation_rate', case
                 when coalesce(sub_stats.users, 0) = 0 then 0
                 else round(coalesce(vote_stats.users, 0)::numeric / sub_stats.users * 100)
               end
             ) as row
      from public.subject_drops pd
      left join lateral (
        select count(*) as cnt, count(distinct s.user_id) as users
        from public.submissions s
        where s.drop_id = pd.id and s.thumb_path is not null
      ) sub_stats on true
      left join lateral (
        select count(*) as cnt, count(distinct v.voter_id) as users
        from public.votes v
        where v.drop_id = pd.id
      ) vote_stats on true
      group by pd.drop_date, sub_stats.cnt, sub_stats.users, vote_stats.cnt, vote_stats.users
      order by pd.drop_date desc
      limit 14
    ) q
  ), '[]'::jsonb);

  -- Aggregate engagement totals
  totals := jsonb_build_object(
    'total_premium', (select count(*) from public.profiles where is_premium),
    'total_admins', (select count(*) from public.profiles where is_admin),
    'active_streaks', (select count(*) from public.streaks where is_alive),
    'avg_streak_weeks', coalesce((
      select round(avg(current_weeks)::numeric, 1)
      from public.streaks where is_alive and current_weeks > 0
    ), 0),
    'max_streak_weeks', coalesce((
      select max(current_weeks) from public.streaks
    ), 0),
    'total_reactions', (select count(*) from public.reactions)
  );

  return jsonb_build_object('daily', daily, 'totals', totals);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_recent_submissions()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'thumb_path', s.thumb_path,
        'shooter', pr.username,
        'shooter_id', s.user_id,
        'vote_count', s.vote_count,
        'reaction_count', s.reaction_count,
        'drop_date', pd.drop_date,
        'prompt', pd.prompt,
        'captured_at', s.captured_at
      )
      order by s.created_at desc
    )
    from public.submissions s
    join public.profiles pr on pr.id = s.user_id
    join public.subject_drops pd on pd.id = s.drop_id
    where s.thumb_path is not null
    limit 10
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_drop_gallery(p_drop uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  payload jsonb;
  dr record;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  -- Materialized gallery (revealed drops).
  select ga.payload into payload
  from public.galleries ga
  where ga.drop_id = p_drop;

  if payload is not null then
    return jsonb_build_object(
      'drop_id',   payload ->> 'drop_id',
      'drop_date', payload ->> 'drop_date',
      'prompt',    payload ->> 'prompt',
      'photos',    coalesce(payload -> 'photos', '[]'::jsonb)
    );
  end if;

  -- Fallback: build from submissions (unrevealed drop preview).
  select pd.drop_date, pr.text as prompt
    into dr
  from public.subject_drops pd
  join public.subjects pr on pr.id = pd.prompt_id
  where pd.id = p_drop;

  if dr.drop_date is null then
    return jsonb_build_object('drop_id', null, 'drop_date', null, 'prompt', null, 'photos', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'drop_id',   p_drop,
    'drop_date', dr.drop_date,
    'prompt',    dr.prompt,
    'photos',    coalesce((
      select jsonb_agg(obj order by rnk)
      from (
        select jsonb_build_object(
                 'id',           s.id,
                 'thumb_path',   s.thumb_path,
                 'image_path',   s.image_path,
                 'user_id',      s.user_id,
                 'shooter',      pr.username,
                 'hearts',       s.vote_count + s.reaction_count,
                 'is_potd',      s.is_potd,
                 'bt_score',     s.bt_score,
                 'captured_at',  s.captured_at
               ) as obj,
               row_number() over (order by s.bt_score desc nulls last, s.vote_count desc, s.id) as rnk
        from public.submissions s
        join public.profiles pr on pr.id = s.user_id
        where s.drop_id = p_drop and s.thumb_path is not null
        order by s.bt_score desc nulls last, s.vote_count desc, s.id
        limit 24
      ) q
    ), '[]'::jsonb)
  );
end;
$function$
;
