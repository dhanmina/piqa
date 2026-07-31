-- Studio Challenges (docs/build-steps.md §2C, docs/feature-research.md §4b):
-- an occasional, OPTIONAL, studio-only theme. Hearts-only, unranked, walled off
-- from the fair game — this is NOT a second judged Subject. No peer voting, no
-- ranking, no winner, ever: submissions render in chronological order, never
-- sorted by heart count, and no RPC here touches subjects/subject_drops/
-- submissions/votes or the Bradley-Terry pipeline. Same fairness law that
-- governs 20260730000001_studios.sql's Standing card, applied to a second
-- surface. Deployed inert behind the `studio_challenges_enabled` config flag
-- (independent of `studios_enabled`, so challenges can stay dark after Studios
-- itself goes live). RPC-only, same as studios/studio_members — zero policies
-- on the tables themselves.

create table public.studio_challenges (
  id           uuid primary key default gen_random_uuid(),
  studio_id    uuid not null references public.studios (id) on delete cascade,
  theme        text not null check (char_length(theme) between 2 and 60),
  created_by   uuid not null references public.profiles (id) on delete cascade,
  ends_at      timestamptz not null,
  created_at   timestamptz not null default now()
);
create index studio_challenges_studio_idx on public.studio_challenges (studio_id, created_at desc);

create table public.studio_challenge_submissions (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.studio_challenges (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  image_path    text not null,
  thumb_path    text not null,
  captured_at   timestamptz not null,
  created_at    timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index studio_challenge_submissions_challenge_idx
  on public.studio_challenge_submissions (challenge_id, created_at asc);

-- No heart_count column, no trigger: studio_member_cap caps a studio at 8
-- members, so a submission has at most 7 hearts — counting live in
-- get_studio_challenge() is simpler and correct at this scale.
create table public.studio_challenge_hearts (
  submission_id uuid not null references public.studio_challenge_submissions (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (submission_id, user_id)
);

alter table public.studio_challenges            enable row level security;
alter table public.studio_challenge_submissions enable row level security;
alter table public.studio_challenge_hearts      enable row level security;
-- No policies on purpose — every read/write goes through a security-definer
-- RPC below, matching studios/studio_members.

insert into public.config (key, value) values
  ('studio_challenges_enabled', 'false')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- start_studio_challenge(theme, duration_hours) — Director only. One active
-- challenge per studio at a time.
-- ---------------------------------------------------------------------------
create or replace function public.start_studio_challenge(p_theme text, p_duration_hours int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_theme text := trim(p_theme);
  sid uuid;
  new_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(clean_theme) < 2 or char_length(clean_theme) > 60 then
    return jsonb_build_object('ok', false, 'reason', 'bad_theme');
  end if;
  if p_duration_hours not in (24, 72, 168) then
    return jsonb_build_object('ok', false, 'reason', 'bad_duration');
  end if;

  select id into sid from public.studios where director_id = uid;
  if sid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_director');
  end if;

  if exists (
    select 1 from public.studio_challenges
    where studio_id = sid and ends_at > now()
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_active');
  end if;

  insert into public.studio_challenges (studio_id, theme, created_by, ends_at)
  values (sid, clean_theme, uid, now() + make_interval(hours => p_duration_hours))
  returning id into new_id;

  return jsonb_build_object('ok', true, 'challenge_id', new_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_studio_challenge() — the most recent challenge for the caller's studio,
-- with its submissions. Submissions are always ordered by created_at asc —
-- NEVER by heart count, which would read as a ranking.
-- ---------------------------------------------------------------------------
create or replace function public.get_studio_challenge()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  ch public.studio_challenges%rowtype;
  my_submission uuid;
  submissions_json jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select studio_id into sid from public.studio_members where user_id = uid;
  if sid is null then
    return jsonb_build_object('found', false);
  end if;

  select * into ch from public.studio_challenges
    where studio_id = sid
    order by created_at desc
    limit 1;
  if ch.id is null then
    return jsonb_build_object('found', false);
  end if;

  select cs.id into my_submission
    from public.studio_challenge_submissions cs
    where cs.challenge_id = ch.id and cs.user_id = uid;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', cs.id,
             'user_id', cs.user_id,
             'username', pr.username,
             'avatar_url', pr.avatar_url,
             'thumb_path', cs.thumb_path,
             'heart_count', (
               select count(*) from public.studio_challenge_hearts h
               where h.submission_id = cs.id
             ),
             'hearted_by_me', exists (
               select 1 from public.studio_challenge_hearts h
               where h.submission_id = cs.id and h.user_id = uid
             )
           )
           order by cs.created_at asc
         ), '[]'::jsonb)
    into submissions_json
  from public.studio_challenge_submissions cs
  join public.profiles pr on pr.id = cs.user_id
  where cs.challenge_id = ch.id;

  return jsonb_build_object(
    'found', true,
    'challenge_id', ch.id,
    'theme', ch.theme,
    'ends_at', ch.ends_at,
    'is_active', ch.ends_at > now(),
    'my_submission_id', my_submission,
    'submissions', submissions_json
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- record_studio_challenge_photo(challenge, image_path, thumb_path) — the
-- post-upload insert step (the table has zero client policies, so the client
-- can't insert directly the way it does for daily/free shots).
-- ---------------------------------------------------------------------------
create or replace function public.record_studio_challenge_photo(
  p_challenge_id uuid,
  p_image_path text,
  p_thumb_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ch public.studio_challenges%rowtype;
  new_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into ch from public.studio_challenges where id = p_challenge_id;
  if ch.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not exists (
    select 1 from public.studio_members
    where user_id = uid and studio_id = ch.studio_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if ch.ends_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'ended');
  end if;

  begin
    insert into public.studio_challenge_submissions
      (challenge_id, user_id, image_path, thumb_path, captured_at)
    values (p_challenge_id, uid, p_image_path, p_thumb_path, now())
    returning id into new_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end;

  return jsonb_build_object('ok', true, 'submission_id', new_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- toggle_studio_challenge_heart(submission) — insert-or-delete own heart row.
-- No self-hearting.
-- ---------------------------------------------------------------------------
create or replace function public.toggle_studio_challenge_heart(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sub public.studio_challenge_submissions%rowtype;
  sid uuid;
  now_hearted boolean;
  new_count int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into sub from public.studio_challenge_submissions where id = p_submission_id;
  if sub.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if sub.user_id = uid then
    return jsonb_build_object('ok', false, 'reason', 'no_self_heart');
  end if;

  select studio_id into sid from public.studio_challenges where id = sub.challenge_id;
  if not exists (
    select 1 from public.studio_members
    where user_id = uid and studio_id = sid
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  if exists (
    select 1 from public.studio_challenge_hearts
    where submission_id = p_submission_id and user_id = uid
  ) then
    delete from public.studio_challenge_hearts
      where submission_id = p_submission_id and user_id = uid;
    now_hearted := false;
  else
    insert into public.studio_challenge_hearts (submission_id, user_id)
      values (p_submission_id, uid);
    now_hearted := true;
  end if;

  select count(*) into new_count
    from public.studio_challenge_hearts where submission_id = p_submission_id;

  return jsonb_build_object('ok', true, 'hearted', now_hearted, 'heart_count', new_count);
end;
$$;

revoke execute on function public.start_studio_challenge(text, int)         from public, anon;
revoke execute on function public.get_studio_challenge()                    from public, anon;
revoke execute on function public.record_studio_challenge_photo(uuid, text, text) from public, anon;
revoke execute on function public.toggle_studio_challenge_heart(uuid)       from public, anon;

grant execute on function public.start_studio_challenge(text, int)          to authenticated;
grant execute on function public.get_studio_challenge()                     to authenticated;
grant execute on function public.record_studio_challenge_photo(uuid, text, text) to authenticated;
grant execute on function public.toggle_studio_challenge_heart(uuid)        to authenticated;

-- ---------------------------------------------------------------------------
-- Storage — reuse the existing `submissions` bucket, new path prefix:
--   submissions/studio-challenges/{challenge_id}/{user_id}.jpg (+ _thumb.jpg)
-- Comparing challenge.id::text to the path segment (rather than casting the
-- path segment to uuid) means a malformed path fails the policy instead of
-- throwing a hard error.
--
-- Membership is checked through a security-definer function, NOT an inline
-- exists() against studio_challenges/studio_members directly: those tables
-- have zero grants to `authenticated` by design (RPC-only), and Postgres
-- requires table-level SELECT on every relation a policy's expression touches
-- just to PLAN the query — even for rows where the row-level condition would
-- never match. An inline exists() here breaks signed-URL generation for the
-- ENTIRE submissions bucket for every user, not just studio-challenge paths,
-- because storage.objects policies are OR'd together and planned as one query.
-- A security-definer function sidesteps this the same way every other
-- cross-table check in this schema already does (is_admin(), cfg_int(), …).
-- ---------------------------------------------------------------------------
create or replace function public.is_studio_challenge_participant(p_challenge_id text)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.studio_challenges c
    join public.studio_members sm on sm.studio_id = c.studio_id
    where c.id::text = p_challenge_id and sm.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_studio_challenge_participant(text) from public, anon;
grant execute on function public.is_studio_challenge_participant(text) to authenticated;

create policy "users write own studio challenge objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = 'studio-challenges'
    and storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
    and public.is_studio_challenge_participant((storage.foldername(name))[2])
  );

create policy "studio members read studio challenge objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = 'studio-challenges'
    and public.is_studio_challenge_participant((storage.foldername(name))[2])
  );

create policy "users delete own studio challenge objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = 'studio-challenges'
    and storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
  );
