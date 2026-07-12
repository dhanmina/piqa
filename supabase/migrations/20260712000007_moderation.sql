-- Phase 4 · Step 8a — Moderation: report · quarantine · block (spec §12, §9).
--
--  * report_submission: one report hides the photo from the reporter instantly;
--    reports_quarantine_at distinct reporters auto-quarantine it (pulled from
--    voting + gallery pending review). Reporters never see outcomes.
--  * blocks: mutual invisibility — a block hides each user from the other in
--    matchups, galleries, and profiles.
-- get_matchup and get_gallery now exclude quarantined photos, blocked users
-- (both directions), and (for the reporter) anything they've reported.

alter table public.submissions
  add column if not exists quarantined boolean not null default false;

create index if not exists submissions_quarantined_idx on public.submissions (drop_id) where quarantined;

-- ---------------------------------------------------------------------------
-- blocks — one-way declaration, enforced as mutual invisibility. Own-row RLS
-- (like follows); the definer serving RPCs read both directions.
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy "users read own blocks"
  on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "users insert own block"
  on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "users delete own block"
  on public.blocks for delete to authenticated using (blocker_id = auth.uid());

grant select, insert, delete on public.blocks to authenticated;

-- ---------------------------------------------------------------------------
-- report_submission — insert a report (own), then auto-quarantine at the
-- configured distinct-reporter threshold. Idempotent per reporter (uq).
-- ---------------------------------------------------------------------------
create or replace function public.report_submission(p_submission uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  threshold int := public.cfg_int('reports_quarantine_at', 3);
  distinct_reporters int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_reason not in ('nudity', 'violence', 'harassment', 'not_real_photo', 'other') then
    return jsonb_build_object('ok', false, 'reason', 'bad_reason');
  end if;

  insert into public.reports (user_id, submission_id, reason)
  values (uid, p_submission, p_reason)
  on conflict (user_id, submission_id) do nothing;

  select count(distinct user_id) into distinct_reporters
  from public.reports where submission_id = p_submission;

  if distinct_reporters >= threshold then
    update public.submissions set quarantined = true where id = p_submission;
  end if;

  -- Reporters never see outcomes (spec §12) — always a neutral acknowledgement.
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.report_submission(uuid, text) from public, anon;
grant  execute on function public.report_submission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_matchup — exclude quarantined, blocked (both directions), and my reports.
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
      and coalesce(s.quarantined, false) = false
      and s.user_id not in (
        select blocked_id from public.blocks where blocker_id = uid
        union
        select blocker_id from public.blocks where blocked_id = uid
      )
      and not exists (select 1 from public.reports r where r.submission_id = s.id and r.user_id = uid)
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

-- ---------------------------------------------------------------------------
-- filter_public_photos — strip quarantined / blocked / self-reported photos
-- from a materialized gallery photos array at read time (the blob is immutable).
-- ---------------------------------------------------------------------------
create or replace function public.filter_public_photos(p_photos jsonb, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(ph), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) ph
  where not exists (
          select 1 from public.submissions s
          where s.id = (ph->>'id')::uuid and s.quarantined
        )
    and (ph->>'user_id')::uuid not in (
          select blocked_id from public.blocks where blocker_id = p_viewer
          union
          select blocker_id from public.blocks where blocked_id = p_viewer
        )
    and not exists (
          select 1 from public.reports r
          where r.submission_id = (ph->>'id')::uuid and r.user_id = p_viewer
        );
$$;

revoke execute on function public.filter_public_photos(jsonb, uuid) from public, anon;
grant  execute on function public.filter_public_photos(jsonb, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_gallery — Phase 3 body, with the returned photos passed through the
-- quarantine / block / self-report filter.
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
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.prompt_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
    order by pd.drop_date desc
    limit 1;
    if g.drop_id is not null then payload := g.payload; end if;
  end if;

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
    'photos', public.filter_public_photos(payload -> 'photos', uid),
    'is_seed', is_seed,
    'past', past,
    'next_drop_at', nxt
  );
end;
$$;

revoke execute on function public.get_gallery(uuid) from public, anon;
grant  execute on function public.get_gallery(uuid) to authenticated;
