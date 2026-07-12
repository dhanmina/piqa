-- Phase 4 · Step 3 — Curator polish (spec §6, §10).
--
--  1. Curator XP: each pick earns curator_xp_per_vote, capped at curator_xp_cap
--     per day (spec §10: pick +1, cap 30/day). Awarded silently inside cast_vote
--     (quiet mode — it only ever surfaces on Profile, never mid-flow).
--  2. Position fairness: get_matchup previously always put the lower-rated photo
--     on top (pairs are neighbours in rating order). Blind judging must be
--     position-neutral, so the two photos are now randomly assigned top/bottom
--     per pair. Ranking is by photo id, so this is display-only.
--
-- The 50/day cap and 2s min-interval already live in cast_vote (Phase 3).

insert into public.config (key, value) values
  ('curator_xp_cap',       '30'),
  ('curator_xp_per_vote',  '1')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- cast_vote — Phase 3 logic + curator XP for the first N picks of the day.
-- ---------------------------------------------------------------------------
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
  cur_xp_cap int := public.cfg_int('curator_xp_cap', 30);
  cur_xp_per int := public.cfg_int('curator_xp_per_vote', 1);
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

  begin
    insert into public.votes (drop_id, voter_id, winner_id, loser_id)
    values (p_drop, uid, p_winner, p_loser);
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'reason', 'duplicate');
    when others then
      return jsonb_build_object('ok', false, 'reason', 'rejected');
  end;

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

  -- Curator XP: this pick is number cast_today+1; award while under the daily
  -- cap. Silent — never returned to the client (quiet mode, spec §10).
  if cast_today < cur_xp_cap then
    update public.profiles set xp = xp + cur_xp_per where id = uid;
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

-- ---------------------------------------------------------------------------
-- get_matchup — Phase 3 selection, but each pair's two photos are randomly
-- assigned top/bottom so no position correlates with strength (blind fairness).
-- ---------------------------------------------------------------------------
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

  with cand as (
    select s.id, s.thumb_path, s.rating, s.vote_count
    from public.submissions s
    where s.drop_id = d.id
      and s.user_id <> uid
      and s.thumb_path is not null
  ),
  pool as (
    select *, row_number() over (order by vote_count asc, random()) as expo
    from cand
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
    'remaining', remaining,
    'capped', false,
    'pairs', pairs
  );
end;
$$;

revoke execute on function public.get_matchup() from public, anon;
grant  execute on function public.get_matchup() to authenticated;
