-- Piqa initial schema — spec §13 (tables + RLS), §14 (indexes), §16 (beta config)
-- Every table has RLS. All thresholds live in `config`, never in code.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (char_length(username) between 3 and 24),
  avatar_url  text,
  timezone    text not null default 'Asia/Manila',
  region      text not null default 'BETA',
  is_premium  boolean not null default false,
  xp          integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- prompts (internal name; user-facing word is "Today's Shot")
-- ---------------------------------------------------------------------------
create table public.prompts (
  id           uuid primary key default gen_random_uuid(),
  text         text not null,
  category     text not null default 'object'
               check (category in ('object','color','light','pov','emotion','absurd')),
  is_sponsored boolean not null default false,
  used_at      date,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- prompt_drops — one per region per calendar day
-- ---------------------------------------------------------------------------
create table public.prompt_drops (
  id               uuid primary key default gen_random_uuid(),
  prompt_id        uuid not null references public.prompts (id),
  region           text not null,
  drop_date        date not null,
  drops_at         timestamptz not null,
  submit_closes_at timestamptz not null,
  voting_closes_at timestamptz not null,
  status           text not null default 'scheduled'
                   check (status in ('scheduled','live','closed','revealed')),
  created_at       timestamptz not null default now(),
  unique (region, drop_date)
);

-- ---------------------------------------------------------------------------
-- submissions — one public slot per user per drop
-- ---------------------------------------------------------------------------
create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  drop_id        uuid not null references public.prompt_drops (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  image_path     text,
  thumb_path     text,
  captured_at    timestamptz not null,
  rating         integer not null default 1000,
  bt_score       double precision,
  vote_count     integer not null default 0,
  reaction_count integer not null default 0,
  quick_draw     boolean not null default false,
  in_gallery     boolean not null default false,
  is_potd        boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (drop_id, user_id)
);

-- ---------------------------------------------------------------------------
-- votes — blind pairwise picks
-- ---------------------------------------------------------------------------
create table public.votes (
  id         uuid primary key default gen_random_uuid(),
  drop_id    uuid not null references public.prompt_drops (id) on delete cascade,
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  winner_id  uuid not null references public.submissions (id) on delete cascade,
  loser_id   uuid not null references public.submissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (winner_id <> loser_id)
);

-- uq voter+pair, orderless: the same two photos can only be judged once per voter
create unique index votes_voter_pair_uq on public.votes
  (voter_id, least(winner_id, loser_id), greatest(winner_id, loser_id));

-- ---------------------------------------------------------------------------
-- streaks — weekly goal (4 of 7), submission-based only
-- ---------------------------------------------------------------------------
create table public.streaks (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  current_weeks  integer not null default 0,
  days_this_week integer not null default 0,
  shields        integer not null default 1,
  last_active    date,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reactions — signed appreciation; emoji kept for future packs, v1 = 'heart'
-- ---------------------------------------------------------------------------
create table public.reactions (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  emoji         text not null default 'heart',
  created_at    timestamptz not null default now(),
  primary key (user_id, submission_id)
);

-- ---------------------------------------------------------------------------
-- follows — one-way, counts hidden from everyone
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ---------------------------------------------------------------------------
-- reports — spec §12 (status added per moderation pipeline)
-- ---------------------------------------------------------------------------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  reason        text not null
                check (reason in ('nudity','violence','harassment','not_real_photo','other')),
  status        text not null default 'pending'
                check (status in ('pending','actioned','dismissed')),
  created_at    timestamptz not null default now(),
  unique (user_id, submission_id)
);

-- ---------------------------------------------------------------------------
-- free_shots — private archive; unlimited capture, owner-only unless showcased
-- ---------------------------------------------------------------------------
create table public.free_shots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  image_path   text,
  thumb_path   text,
  captured_at  timestamptz not null,
  is_showcased boolean not null default false,
  starred      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- config — every threshold is a row here, tunable without deploy
-- ---------------------------------------------------------------------------
create table public.config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.config (key, value) values
  ('gallery_pct',             '20'),
  ('gallery_min',             '10'),
  ('gallery_max',             '50'),
  ('vote_cap',                '50'),
  ('votes_per_set',           '10'),
  ('quorum',                  '8'),
  ('beta_mode',               'true'),
  ('beta_gallery_all_below',  '15'),
  ('vote_min_interval_s',     '2'),
  ('elo_k',                   '32'),
  ('elo_start',               '1000'),
  ('bt_shrink_c',             '5'),
  ('quick_draw_minutes',      '30'),
  ('stars_per_month',         '5'),
  ('xp_daily_cap',            '250'),
  ('reports_quarantine_at',   '3');

-- ---------------------------------------------------------------------------
-- Indexes — spec §14
-- ---------------------------------------------------------------------------
create index submissions_drop_vote_count_idx on public.submissions (drop_id, vote_count);
create index votes_voter_drop_idx            on public.votes (voter_id, drop_id);
create index submissions_gallery_idx         on public.submissions (drop_id) where in_gallery;
create index submissions_user_idx            on public.submissions (user_id);
create index free_shots_user_idx             on public.free_shots (user_id, captured_at desc);
create index prompt_drops_region_date_idx    on public.prompt_drops (region, drop_date desc);

-- ---------------------------------------------------------------------------
-- Trigger: no self-vote, and both photos must belong to the vote's drop
-- ---------------------------------------------------------------------------
create or replace function public.check_vote_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
  l record;
begin
  select user_id, drop_id into w from public.submissions where id = new.winner_id;
  select user_id, drop_id into l from public.submissions where id = new.loser_id;

  if w is null or l is null then
    raise exception 'vote references missing submission';
  end if;
  if w.user_id = new.voter_id or l.user_id = new.voter_id then
    raise exception 'self-vote is not allowed';
  end if;
  if w.drop_id <> new.drop_id or l.drop_id <> new.drop_id then
    raise exception 'submissions do not belong to this drop';
  end if;
  return new;
end;
$$;

create trigger votes_integrity
  before insert on public.votes
  for each row execute function public.check_vote_integrity();

-- ---------------------------------------------------------------------------
-- Trigger: create profile + streak row on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  final_name text;
begin
  base_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1)
  );
  base_name := lower(regexp_replace(base_name, '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base_name) < 3 then
    base_name := 'shooter';
  end if;
  final_name := left(base_name, 24);
  if exists (select 1 from public.profiles where username = final_name) then
    final_name := left(base_name, 19) || '_' || substr(md5(random()::text), 1, 4);
  end if;

  insert into public.profiles (id, username) values (new.id, final_name);
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS — every table
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.prompts      enable row level security;
alter table public.prompt_drops enable row level security;
alter table public.submissions  enable row level security;
alter table public.votes        enable row level security;
alter table public.streaks      enable row level security;
alter table public.reactions    enable row level security;
alter table public.follows      enable row level security;
alter table public.reports      enable row level security;
alter table public.free_shots   enable row level security;
alter table public.config       enable row level security;

-- profiles: public highlight reels — readable by any authed user; write own
create policy "profiles are readable by authed users"
  on public.profiles for select to authenticated using (true);
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- prompts: visible only once their drop has actually dropped (no leaks)
create policy "prompts visible after drop"
  on public.prompts for select to authenticated
  using (exists (
    select 1 from public.prompt_drops d
    where d.prompt_id = prompts.id and d.drops_at <= now()
  ));

-- prompt_drops: readable (rows carry no prompt text; prompts RLS guards leaks)
create policy "drops are readable by authed users"
  on public.prompt_drops for select to authenticated using (true);

-- submissions: own rows always; others only once in a revealed gallery.
-- Voting pairs are served by the get-matchup RPC (security definer), not here.
create policy "own submissions readable"
  on public.submissions for select to authenticated using (user_id = auth.uid());
create policy "gallery submissions are public"
  on public.submissions for select to authenticated using (in_gallery = true);
create policy "users insert own submission"
  on public.submissions for insert to authenticated with check (user_id = auth.uid());
create policy "users update own submission"
  on public.submissions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own submission"
  on public.submissions for delete to authenticated using (user_id = auth.uid());

-- votes: open to every authed user (spec: submission not required); own rows only
create policy "users insert own votes"
  on public.votes for insert to authenticated with check (voter_id = auth.uid());
create policy "users read own votes"
  on public.votes for select to authenticated using (voter_id = auth.uid());

-- streaks: own row only (close-day writes via service role)
create policy "users read own streak"
  on public.streaks for select to authenticated using (user_id = auth.uid());
create policy "users insert own streak"
  on public.streaks for insert to authenticated with check (user_id = auth.uid());
create policy "users update own streak"
  on public.streaks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reactions: appreciation is signed — readable; write/remove own
create policy "reactions readable by authed users"
  on public.reactions for select to authenticated using (true);
create policy "users insert own reaction"
  on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy "users delete own reaction"
  on public.reactions for delete to authenticated using (user_id = auth.uid());

-- follows: counts hidden from everyone — you may only see who YOU follow
create policy "users read own follows"
  on public.follows for select to authenticated using (follower_id = auth.uid());
create policy "users insert own follow"
  on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "users delete own follow"
  on public.follows for delete to authenticated using (follower_id = auth.uid());

-- reports: write-only for users; reporters never see outcomes
create policy "users insert own report"
  on public.reports for insert to authenticated with check (user_id = auth.uid());

-- free_shots: owner-only unless showcased
create policy "own or showcased free shots readable"
  on public.free_shots for select to authenticated
  using (user_id = auth.uid() or is_showcased = true);
create policy "users insert own free shot"
  on public.free_shots for insert to authenticated with check (user_id = auth.uid());
create policy "users update own free shot"
  on public.free_shots for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own free shot"
  on public.free_shots for delete to authenticated using (user_id = auth.uid());

-- config: readable by all authed users; writes via service role only
create policy "config readable by authed users"
  on public.config for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage — submissions (private, signed URLs) · avatars (public)
-- Paths: submissions/{drop_id}/{user_id}.jpg (+ {user_id}_thumb.jpg)
--        submissions/free/{user_id}/{shot_id}.jpg (+ _thumb)
--        avatars/{user_id}.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false), ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "users write own submission objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions' and (
      storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
      or (storage.foldername(name))[1] = 'free'
         and (storage.foldername(name))[2] = auth.uid()::text
    )
  );

create policy "users read own submission objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions' and (
      storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
      or (storage.foldername(name))[1] = 'free'
         and (storage.foldername(name))[2] = auth.uid()::text
    )
  );

create policy "users delete own submission objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions' and (
      storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
      or (storage.foldername(name))[1] = 'free'
         and (storage.foldername(name))[2] = auth.uid()::text
    )
  );

create policy "avatars are public to read"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "users write own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and storage.filename(name) ~ ('^' || auth.uid()::text || '\.(jpg|png|webp)$')
  );

create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and storage.filename(name) ~ ('^' || auth.uid()::text || '\.(jpg|png|webp)$')
  );
