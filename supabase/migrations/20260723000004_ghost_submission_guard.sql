-- Ghost-submission guard: never serve a submission whose image upload never landed.
--
-- Offline-first capture inserts the submission row and uploads the image as
-- separate steps. If the upload fails after (or the file is otherwise absent),
-- the row survives with a thumb_path pointing at a file that does not exist. That
-- ghost was entering the curate pool as a BLANK voting pair and could take a
-- gallery slot (blank tile) on a small drop. Guard both consumer paths by
-- requiring the thumb object to actually exist in storage.objects:
--   get_matchup -> ghosts never enter voting
--   close_day   -> ghosts never rank / gallery / PotD (covers small-drop all-in)
-- SQL-only (OTA-class): reaches every build immediately, no rebuild.

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
      -- exclude ghosts (row present, image upload never landed) from ranking,
      -- the gallery, and PotD. Covers the small-drop 'everyone gets in' case.
      and exists (select 1 from storage.objects o where o.bucket_id = 'submissions' and o.name = submissions.thumb_path)
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
      -- image must actually exist in storage: a failed upload leaves a row with a
      -- thumb_path but no file, which would render as a BLANK pair in curate.
      and exists (select 1 from storage.objects o where o.bucket_id = 'submissions' and o.name = s.thumb_path)
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

