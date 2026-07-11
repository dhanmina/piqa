-- Phase 3 · close_day — the most careful code in the app (spec §7).
--
-- Official ranking is a Bradley-Terry MLE fit on the day's FULL vote table via
-- the MM (minorization-maximization) algorithm — order-independent, so rank
-- depends only on WHO you beat, never WHEN you submitted (structural late-
-- submitter fairness). Regularized with one virtual half-win / half-loss vs an
-- "average" dummy (strength fixed at 1 after we normalize reals to geometric
-- mean 1) so undefeated / winless / disconnected photos stay finite. A
-- confidence shrink then damps low-comparison flukes toward the mean — which is
-- also the "conservative prior rather than exclude" failsafe for <5-comp photos.
--
-- All thresholds are config rows. Idempotent: safe to re-run (dev reset re-runs
-- it); XP/streaks are awarded only on the FIRST close (tracked by the galleries
-- row's prior existence).

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
  nmat double precision[];      -- k×k comparison matrix (array_fill 2-D)
  s double precision[];         -- strengths
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
  gallery_n int;
  potd_id uuid;
  already_closed boolean;
  v record;
  wi int;
  li int;
  i int;
  j int;
  payload jsonb;
begin
  -- Rank only uploaded submissions (a row with no thumb never entered voting).
  ids := array(
    select id from public.submissions
    where drop_id = p_drop and thumb_path is not null
    order by id
  );
  k := coalesce(array_length(ids, 1), 0);

  already_closed := exists (select 1 from public.galleries where drop_id = p_drop);

  -- Always start from a clean slate so re-runs are idempotent.
  update public.submissions
    set in_gallery = false, is_potd = false
    where drop_id = p_drop;

  if k = 0 then
    -- No photos — write an empty gallery so the tab still resolves.
    insert into public.galleries (drop_id, payload)
    values (p_drop, jsonb_build_object('drop_id', p_drop, 'photos', '[]'::jsonb))
    on conflict (drop_id) do update set payload = excluded.payload, created_at = now();
    update public.prompt_drops set status = 'revealed' where id = p_drop;
    return jsonb_build_object('ok', true, 'submissions', 0, 'gallery', 0, 'potd', null);
  end if;

  -- ---- tally wins + comparison matrix from the vote table -----------------
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

  -- ---- MM iteration (synchronous update, ~60 iters is ample for ≤1k) -------
  news := array_fill(1::double precision, array[k]);
  for iter in 1..60 loop
    for i in 1..k loop
      denom := 1.0 / (s[i] + 1.0);          -- dummy: n=1, strength 1
      for j in 1..k loop
        if nmat[i][j] > 0 then
          denom := denom + nmat[i][j] / (s[i] + s[j]);
        end if;
      end loop;
      numer := wins[i] + 0.5;               -- +½ virtual win vs dummy
      news[i] := numer / denom;
    end loop;
    -- normalize to geometric mean 1 (fixes the scale; keeps dummy = average)
    ln_sum := 0;
    for i in 1..k loop ln_sum := ln_sum + ln(news[i]); end loop;
    gm := exp(ln_sum / k);
    for i in 1..k loop s[i] := news[i] / gm; end loop;
  end loop;

  -- ---- log-strength → confidence-shrunk score -----------------------------
  bt := array_fill(0::double precision, array[k]);
  ln_sum := 0;
  for i in 1..k loop
    bt[i] := ln(s[i]);
    ln_sum := ln_sum + bt[i];
  end loop;
  mu := ln_sum / k;                          -- ≈ 0 by construction
  score := array_fill(0::double precision, array[k]);
  for i in 1..k loop
    score[i] := mu + (bt[i] - mu) * ncomp[i]::double precision / (ncomp[i] + cval);
  end loop;

  -- ---- gallery size: top pct%, clamped [min,max], never > k ---------------
  gallery_n := ceil(k * gpct / 100.0);
  gallery_n := greatest(gallery_n, gmin);
  gallery_n := least(gallery_n, gmax);
  gallery_n := least(gallery_n, k);
  if beta and k < beta_all_below then
    gallery_n := k;                          -- beta: everyone makes the gallery
  end if;

  -- write bt_score + gallery flags
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

  -- ---- PotD: highest score meeting quorum; tie → more comps → win rate ----
  select id into potd_id from (
    select ids[idx] as id, score[idx] as sc, ncomp[idx] as nc,
           case when ncomp[idx] > 0 then wins[idx] / ncomp[idx] else 0 end as wr
    from generate_series(1, k) as gs(idx)
  ) t
  where nc >= quorum
  order by sc desc, nc desc, wr desc
  limit 1;

  if potd_id is null then
    -- Nobody met quorum (small beta / low-vote) — relax to top score overall.
    select id into potd_id from (
      select ids[idx] as id, score[idx] as sc, ncomp[idx] as nc,
             case when ncomp[idx] > 0 then wins[idx] / ncomp[idx] else 0 end as wr
      from generate_series(1, k) as gs(idx)
    ) t
    order by sc desc, nc desc, wr desc
    limit 1;
  end if;

  update public.submissions set is_potd = true where id = potd_id;

  -- ---- materialize the gallery as ONE json blob (spec §14) ----------------
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

  -- ---- streaks + XP (basic; full retention is Phase 4) --------------------
  -- Award once per drop: only on the FIRST close (galleries row didn't exist).
  if not already_closed then
    update public.profiles p
      set xp = p.xp + least(
        20
        + (case when s2.quick_draw  then 10  else 0 end)
        + s2.vote_count * 2
        + (case when s2.in_gallery  then 50  else 0 end)
        + (case when s2.is_potd     then 100 else 0 end),
        xp_cap
      )
    from public.submissions s2
    where s2.drop_id = p_drop and s2.user_id = p.id;

    update public.streaks st
      set days_this_week = st.days_this_week + 1,
          last_active = (select drop_date from public.prompt_drops where id = p_drop),
          updated_at = now()
    from public.submissions s2
    where s2.drop_id = p_drop and s2.user_id = st.user_id;
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
-- get_gallery(drop_id) — one RPC feeds the whole World view (spec §11c).
-- Reads the materialized blob (never a live query). p_drop null → latest
-- revealed gallery for my region. Falls back to the seed gallery pre-close.
-- ---------------------------------------------------------------------------
create or replace function public.get_gallery(p_drop uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    join public.prompt_drops pd on pd.id = ga.drop_id
    where ga.drop_id = p_drop and pd.region = prof.region;
    if g.drop_id is not null then payload := g.payload; end if;
  else
    -- latest materialized gallery for my region
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.prompt_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
    order by pd.drop_date desc
    limit 1;
    if g.drop_id is not null then payload := g.payload; end if;
  end if;

  -- Seed fallback: no materialized gallery yet — show the most recent drop's
  -- (seed) submissions so the tab is never blank. Leak-safe: an undropped
  -- prompt's text is nulled.
  if payload is null then
    select pd.id, pd.drop_date,
           case when pd.drops_at <= now() then pr.text else null end as prompt
      into g
    from public.prompt_drops pd
    join public.prompts pr on pr.id = pd.prompt_id
    where pd.region = prof.region
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
                   'is_potd', row_number() over (order by s.vote_count desc, s.id) = 1,
                   'bt_score', null, 'captured_at', s.captured_at
                 ) as obj,
                 row_number() over (order by s.vote_count desc, s.id) as rnk
          from public.submissions s
          join public.profiles pr on pr.id = s.user_id
          where s.drop_id = g.id and s.thumb_path is not null
          order by s.vote_count desc, s.id
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
    join public.prompt_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
      and ga.drop_id <> cur_id
    order by pd.drop_date desc
    limit 30
  ) t;

  -- Live "what's happening now" teaser.
  select pd.drops_at into nxt
  from public.prompt_drops pd
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
$$;

revoke execute on function public.get_gallery(uuid) from public, anon;
grant  execute on function public.get_gallery(uuid) to authenticated;
