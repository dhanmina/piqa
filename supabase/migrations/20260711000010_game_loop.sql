-- Phase 3 · The live game loop (spec §6, §7 live-Elo, §14 serving).
--
-- get_matchup(): a SET of pairs for the current votable drop in my region.
--   - excludes my own submissions and any pair I've already judged
--   - orders by vote_count ASC (exposure floor) with randomness, then pairs
--     neighbours in rating order (prefers similar-Elo match-ups)
--   - returns photo ids + thumb PATHS (client batch-signs) + remaining cap
-- cast_vote(): one transaction — insert vote + Elo-update BOTH photos + bump
--   the winner's counter. 2s server guard, 50/day cap, duplicate/self graceful.

create or replace function public.get_matchup()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  d record;
  cap int := public.cfg_int('vote_cap', 50);
  set_size int := public.cfg_int('votes_per_set', 10);
  cast_today int;
  remaining int;
  pairs jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  -- Current votable drop for my region: dropped, voting still open.
  select pd.id, pd.voting_closes_at
    into d
  from public.prompt_drops pd
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  if d.id is null then
    return jsonb_build_object('drop_id', null, 'remaining', 0, 'capped', false, 'pairs', '[]'::jsonb);
  end if;

  select count(*) into cast_today
  from public.votes where voter_id = uid and drop_id = d.id;

  remaining := greatest(cap - cast_today, 0);
  if remaining <= 0 then
    return jsonb_build_object('drop_id', d.id, 'remaining', 0, 'capped', true, 'pairs', '[]'::jsonb);
  end if;

  -- Need >= 3 submissions to form fair pairs (self-excluded, need even >= 2).
  if (select count(*) from public.submissions where drop_id = d.id and thumb_path is not null) < 3 then
    return jsonb_build_object('drop_id', d.id, 'remaining', remaining, 'capped', false,
                              'pairs', '[]'::jsonb, 'reason', 'insufficient_submissions');
  end if;

  with cand as (
    -- eligible: this drop, not mine, actually uploaded (has a thumb)
    select s.id, s.thumb_path, s.rating, s.vote_count
    from public.submissions s
    where s.drop_id = d.id
      and s.user_id <> uid
      and s.thumb_path is not null
  ),
  pool_size as (
    select count(*) as n from cand
  ),
  elo_pairs as (
    -- Elo-matched pairs for larger pools (>= 10 eligible).
    -- Exposure floor: least-seen photos first, then similar-Elo neighbours.
    select a.id as a_id, a.thumb_path as a_thumb,
           b.id as b_id, b.thumb_path as b_thumb
    from (
      select *, row_number() over (order by vote_count asc, random()) as expo,
               row_number() over (order by rating asc, random()) as rn
      from cand
    ) a
    join (
      select *, row_number() over (order by vote_count asc, random()) as expo,
               row_number() over (order by rating asc, random()) as rn
      from cand
    ) b on b.rn = a.rn + 1 and (a.rn % 2) = 1
    where (select n from pool_size) >= 10
  ),
  rr_pairs as (
    -- Round-robin pairs for small pools (< 10 eligible).
    -- Every possible combination, no Elo matching (too few photos).
    select a.id as a_id, a.thumb_path as a_thumb,
           b.id as b_id, b.thumb_path as b_thumb
    from cand a
    join cand b on b.id > a.id
    where (select n from pool_size) < 10
  ),
  raw_pairs as (
    select * from elo_pairs
    union all
    select * from rr_pairs
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
           jsonb_build_object(
             'a', jsonb_build_object('id', a_id, 'thumb_path', a_thumb),
             'b', jsonb_build_object('id', b_id, 'thumb_path', b_thumb)
           )
         ), '[]'::jsonb)
    into pairs
  from fresh;

  return jsonb_build_object(
    'drop_id', d.id,
    'remaining', remaining,
    'capped', false,
    'pairs', pairs
  );
end;
$$;

revoke execute on function public.get_matchup() from public, anon;
grant  execute on function public.get_matchup() to authenticated;


create or replace function public.cast_vote(p_winner uuid, p_loser uuid, p_drop uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int := public.cfg_int('vote_cap', 50);
  min_gap double precision := public.cfg_num('vote_min_interval_s', 2);
  k double precision := public.cfg_num('elo_k', 32);
  last_at timestamptz;
  cast_today int;
  wr int;
  lr int;
  expected_w double precision;
  new_wr int;
  new_lr int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Server-side rate guard: reject if too soon after this voter's last vote.
  select max(created_at) into last_at
  from public.votes where voter_id = uid and drop_id = p_drop;
  if last_at is not null and extract(epoch from (now() - last_at)) < min_gap then
    return jsonb_build_object('ok', false, 'reason', 'too_fast');
  end if;

  select count(*) into cast_today
  from public.votes where voter_id = uid and drop_id = p_drop;
  if cast_today >= cap then
    return jsonb_build_object('ok', false, 'reason', 'cap_reached', 'remaining', 0);
  end if;

  -- Insert the pick. Self-vote / cross-drop are blocked by votes_integrity
  -- trigger; duplicate pairs by the unique index — both handled gracefully.
  begin
    insert into public.votes (drop_id, voter_id, winner_id, loser_id)
    values (p_drop, uid, p_winner, p_loser);
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'reason', 'duplicate');
    when others then
      return jsonb_build_object('ok', false, 'reason', 'rejected');
  end;

  -- Incremental Elo (K from config): expected = 1 / (1 + 10^((loserR - winnerR)/400)).
  -- Skip for small pools (< 10 eligible) — round-robin, no Elo matching.
  if (select count(*) from public.submissions where drop_id = p_drop and thumb_path is not null) >= 10 then
    select rating into wr from public.submissions where id = p_winner for update;
    select rating into lr from public.submissions where id = p_loser  for update;

    expected_w := 1.0 / (1.0 + power(10.0, (lr - wr) / 400.0));
    new_wr := round(wr + k * (1.0 - expected_w));
    new_lr := round(lr - k * (1.0 - expected_w));

    update public.submissions
      set rating = new_wr, vote_count = vote_count + 1
      where id = p_winner;
    update public.submissions
      set rating = new_lr
      where id = p_loser;
  else
    -- Small pool: just bump vote_count, skip Elo.
    update public.submissions set vote_count = vote_count + 1 where id = p_winner;
    new_wr := null;
    new_lr := null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'remaining', greatest(cap - (cast_today + 1), 0),
    'winner_rating', new_wr,
    'loser_rating', new_lr
  );
end;
$$;

revoke execute on function public.cast_vote(uuid, uuid, uuid) from public, anon;
grant  execute on function public.cast_vote(uuid, uuid, uuid) to authenticated;
