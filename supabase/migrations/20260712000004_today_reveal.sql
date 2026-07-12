-- Phase 4 · Step 4 — Today reveal-ready / done state (spec §11c).
--
-- After voting_closes_at, get_home_state's live drop goes null and Today fell
-- back to the plain waiting screen — the user never saw their closed result.
-- This adds the DONE state's data:
--   * submissions.xp_awarded — the shot's XP for the day (the deferred Step 2
--     "quiet reveal tick"), written by close_day.
--   * get_home_state.last_result — the user's submission on the most recent
--     revealed drop (hearts, gallery/PotD, xp_awarded, thumb) so Today can show
--     "your result" between close and the next drop.
--   * get_home_state.xp — the viewer's total XP, so Today can show the level.

alter table public.submissions
  add column if not exists xp_awarded int not null default 0;

-- ---------------------------------------------------------------------------
-- close_day — unchanged except the XP tail now records xp_awarded per
-- submission (then sums it into the profile), so the reveal can show the tick.
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
  if not already_closed then
    select drop_date, region into as_of_date, drop_region
      from public.prompt_drops where id = p_drop;

    -- Per-submission XP → xp_awarded (comeback doubles the capped day once).
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

    -- Sum the awarded XP into each profile.
    update public.profiles p
      set xp = p.xp + s2.xp_awarded
      from public.submissions s2
      where s2.drop_id = p_drop and s2.thumb_path is not null and s2.user_id = p.id;

    -- Comeback is a one-time welcome — clear it for everyone who submitted.
    update public.streaks st
      set comeback_pending = false, updated_at = now()
    from public.submissions s2
    where s2.drop_id = p_drop and s2.thumb_path is not null
      and s2.user_id = st.user_id and st.comeback_pending;

    -- Re-evaluate the rolling streak for every in-region user who is alive,
    -- has lingering dots, or submitted today.
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
-- get_home_state — add `xp` (viewer total) and `last_result` (their submission
-- on the most recent revealed drop) so Today can render the done/reveal state.
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
  latest_rev record;
  res record;
  drop_json jsonb := null;
  sub_json jsonb := null;
  potd_json jsonb := null;
  streak_json jsonb := null;
  result_json jsonb := null;
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

  -- My result on the most recent revealed drop (the done / reveal-ready state).
  select pd.id as drop_id, pd.drop_date
    into latest_rev
  from public.prompt_drops pd
  where pd.region = prof.region and pd.status = 'revealed'
  order by pd.drop_date desc
  limit 1;

  if latest_rev.drop_id is not null then
    select sub.thumb_path, sub.image_path,
           (sub.vote_count + sub.reaction_count) as hearts,
           sub.in_gallery, sub.is_potd, sub.xp_awarded
      into res
    from public.submissions sub
    where sub.drop_id = latest_rev.drop_id and sub.user_id = uid and sub.thumb_path is not null;

    if res.thumb_path is not null then
      result_json := jsonb_build_object(
        'drop_id', latest_rev.drop_id,
        'drop_date', latest_rev.drop_date,
        'thumb_path', res.thumb_path,
        'hearts', res.hearts,
        'in_gallery', res.in_gallery,
        'is_potd', res.is_potd,
        'xp_awarded', res.xp_awarded
      );
    end if;
  end if;

  return jsonb_build_object(
    'drop', drop_json,
    'next_drop_at', nxt,
    'submission', sub_json,
    'yesterday_potd', potd_json,
    'streak', streak_json,
    'xp', prof.xp,
    'last_result', result_json
  );
end;
$$;

revoke execute on function public.get_home_state() from public, anon;
grant execute on function public.get_home_state() to authenticated;
