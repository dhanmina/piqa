-- Phase 3 · DEV time machine (spec §16 beta only). Lets a solo tester watch
-- shoot → vote → close → gallery in minutes instead of a real 23h cycle.
--
-- Every function is guarded behind config.beta_mode and operates only on the
-- BETA region. They are SECURITY DEFINER (they must write across house accounts
-- and bypass RLS), so the beta_mode gate is the safety latch — flip beta_mode
-- to false in prod and the whole panel goes inert.

-- Guard helper: raises unless we're in beta mode.
create or replace function public.dev_guard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.cfg_bool('beta_mode', true) then
    raise exception 'dev tools are disabled (beta_mode = false)';
  end if;
end;
$$;

-- The drop every dev tool acts on: the most recent BETA drop.
create or replace function public.dev_current_drop()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.prompt_drops
  where region = 'BETA'
  order by drop_date desc, drops_at desc
  limit 1;
$$;

-- Wipe a drop back to a pristine, pre-vote state (shared by force + reset).
create or replace function public.dev_reset_drop(p_drop uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  start_rating int := public.cfg_int('elo_start', 1000);
begin
  delete from public.votes where drop_id = p_drop;
  delete from public.galleries where drop_id = p_drop;
  update public.submissions
    set vote_count = 0, rating = start_rating, bt_score = null,
        in_gallery = false, is_potd = false
    where drop_id = p_drop;
end;
$$;

-- One simulated blind pick between two photos by a house/seed curator.
-- Returns true iff a vote was actually cast (a free, non-owner voter existed).
create or replace function public.dev_sim_game(
  p_drop uuid, a_id uuid, a_uid uuid, a_q double precision,
  b_id uuid, b_uid uuid, b_q double precision)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  voter uuid;
  pwin_a double precision;
  winner uuid;
  loser uuid;
  wr int;
  lr int;
  ew double precision;
  k double precision := public.cfg_num('elo_k', 32);
begin
  -- a house/seed account owning neither photo that hasn't judged this pair
  select u.id into voter
  from auth.users u
  where u.email like '%@joinpiqa.com'
    and u.id <> a_uid and u.id <> b_uid
    and not exists (
      select 1 from public.votes v
      where v.voter_id = u.id
        and least(v.winner_id, v.loser_id)    = least(a_id, b_id)
        and greatest(v.winner_id, v.loser_id) = greatest(a_id, b_id)
    )
  order by random()
  limit 1;

  if voter is null then
    return false;
  end if;

  -- Latent-quality logistic: the stronger photo usually wins, not always.
  pwin_a := 1.0 / (1.0 + exp(-6.0 * (a_q - b_q)));
  if random() < pwin_a then winner := a_id; loser := b_id;
  else                       winner := b_id; loser := a_id;
  end if;

  insert into public.votes (drop_id, voter_id, winner_id, loser_id)
  values (p_drop, voter, winner, loser);

  select rating into wr from public.submissions where id = winner for update;
  select rating into lr from public.submissions where id = loser  for update;
  ew := 1.0 / (1.0 + power(10.0, (lr - wr) / 400.0));
  update public.submissions set rating = round(wr + k * (1 - ew)), vote_count = vote_count + 1 where id = winner;
  update public.submissions set rating = round(lr - k * (1 - ew)) where id = loser;

  return true;
exception when unique_violation then
  return false;
end;
$$;


-- ---------------------------------------------------------------------------
-- 1. Force drop now — make the current BETA drop live starting now, pristine.
-- ---------------------------------------------------------------------------
create or replace function public.dev_force_drop()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  did uuid;
  chosen record;
begin
  perform public.dev_guard();

  select id into did from public.prompt_drops where region = 'BETA' and drop_date = today_local;

  if did is null then
    select id into chosen from public.prompts order by used_at asc nulls first, random() limit 1;
    if chosen.id is null then
      return jsonb_build_object('ok', false, 'reason', 'no_prompts');
    end if;
    insert into public.prompt_drops
      (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
    values
      (chosen.id, 'BETA', today_local, now(), now() + interval '2 hours', now() + interval '6 hours', 'live')
    returning id into did;
    update public.prompts set used_at = today_local where id = chosen.id;
  else
    update public.prompt_drops
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
$$;

-- ---------------------------------------------------------------------------
-- 2. Seed votes — realistic (non-uniform) house-account votes so every photo
--    gets ~8–20 comparisons and some photos are clearly stronger.
-- ---------------------------------------------------------------------------
create or replace function public.dev_seed_votes()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  did uuid;
  k int;
  cover int := 10;          -- coverage goal per photo (guarantees ≥ quorum)
  attempts int;
  prow record;
  orow record;
  arow record;
  brow record;
  g int;
begin
  perform public.dev_guard();
  did := public.dev_current_drop();
  if did is null then
    return jsonb_build_object('ok', false, 'reason', 'no_drop');
  end if;

  drop table if exists _subs;
  drop table if exists _cmp;
  create temp table _subs on commit drop as
    select s.id, s.user_id as uid,
           (abs(hashtext(s.id::text)) % 1000)::double precision / 1000.0 as quality
    from public.submissions s
    where s.drop_id = did and s.thumb_path is not null;
  create temp table _cmp on commit drop as
    select id, 0 as cnt from _subs;

  k := (select count(*) from _subs);
  if k < 2 then
    return jsonb_build_object('ok', false, 'reason', 'need_two_photos', 'submissions', k);
  end if;

  -- Coverage pass: push every photo to ~cover comparisons.
  for prow in select id, uid, quality from _subs loop
    attempts := 0;
    while (select cnt from _cmp where id = prow.id) < cover and attempts < cover * 6 loop
      attempts := attempts + 1;
      select id, uid, quality into orow
        from _subs where uid <> prow.uid and id <> prow.id
        order by random() limit 1;
      exit when orow.id is null;
      if public.dev_sim_game(did, prow.id, prow.uid, prow.quality, orow.id, orow.uid, orow.quality) then
        update _cmp set cnt = cnt + 1 where id in (prow.id, orow.id);
      end if;
    end loop;
  end loop;

  -- Spread pass: extra random games for variety (some photos reach ~20).
  for g in 1..(k * 3) loop
    select id, uid, quality into arow from _subs order by random() limit 1;
    select id, uid, quality into brow from _subs where uid <> arow.uid order by random() limit 1;
    continue when brow.id is null;
    if public.dev_sim_game(did, arow.id, arow.uid, arow.quality, brow.id, brow.uid, brow.quality) then
      update _cmp set cnt = cnt + 1 where id in (arow.id, brow.id);
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'drop_id', did,
    'photos', k,
    'votes', (select count(*) from public.votes where drop_id = did),
    'min_comparisons', (select min(cnt) from _cmp),
    'max_comparisons', (select max(cnt) from _cmp)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Run close-day now — ignore the 8am schedule, close the current drop.
-- ---------------------------------------------------------------------------
create or replace function public.dev_run_close_day()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  did uuid;
begin
  perform public.dev_guard();
  did := public.dev_current_drop();
  if did is null then
    return jsonb_build_object('ok', false, 'reason', 'no_drop');
  end if;
  return public.close_day(did);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reset day — clear votes + gallery flags for the current drop to re-test.
-- ---------------------------------------------------------------------------
create or replace function public.dev_reset_day()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  did uuid;
begin
  perform public.dev_guard();
  did := public.dev_current_drop();
  if did is null then
    return jsonb_build_object('ok', false, 'reason', 'no_drop');
  end if;
  perform public.dev_reset_drop(did);
  update public.prompt_drops
    set status = 'live'
    where id = did and voting_closes_at > now();
  return jsonb_build_object('ok', true, 'drop_id', did);
end;
$$;

-- ---------------------------------------------------------------------------
-- Read-only status for the panel UI.
-- ---------------------------------------------------------------------------
create or replace function public.dev_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  did uuid;
  d record;
  potd_name text;
begin
  perform public.dev_guard();
  did := public.dev_current_drop();
  if did is null then
    return jsonb_build_object('drop_id', null);
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
    'potd_shooter', potd_name
  );
end;
$$;

revoke execute on function public.dev_guard()          from public, anon;
revoke execute on function public.dev_current_drop()   from public, anon;
revoke execute on function public.dev_reset_drop(uuid) from public, anon, authenticated;
revoke execute on function public.dev_sim_game(uuid, uuid, uuid, double precision, uuid, uuid, double precision) from public, anon, authenticated;
revoke execute on function public.dev_force_drop()     from public, anon;
revoke execute on function public.dev_seed_votes()     from public, anon;
revoke execute on function public.dev_run_close_day()  from public, anon;
revoke execute on function public.dev_reset_day()      from public, anon;
revoke execute on function public.dev_status()         from public, anon;

grant execute on function public.dev_force_drop()    to authenticated, service_role;
grant execute on function public.dev_seed_votes()    to authenticated, service_role;
grant execute on function public.dev_run_close_day() to authenticated, service_role;
grant execute on function public.dev_reset_day()     to authenticated, service_role;
grant execute on function public.dev_status()        to authenticated, service_role;
