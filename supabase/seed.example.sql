-- Piqa beta seed TEMPLATE — spec §16
--
-- SETUP: copy this file to supabase/seed.sql (which is gitignored), replace
-- the placeholder password below with your own, then:
--   npx supabase db push --include-seed --linked --yes
-- The real seed.sql is never committed because it contains a working password
-- for accounts that exist on the live Supabase project.
--
-- 4 house accounts + 26 seed users, one prompt + BETA drop today (7pm Manila),
-- 30 submissions with plausible vote counts. Idempotent: safe to re-run.
--
-- House accounts: liwanag / kodachrome / streetgrain / goldenhour
--   emails house1@joinpiqa.com .. house4@joinpiqa.com
-- Seed voters/submitters: seed05@joinpiqa.com .. seed30@joinpiqa.com

select setseed(0.42);

-- ---------------------------------------------------------------------------
-- 30 auth users (deterministic ids). The on_auth_user_created trigger
-- creates matching profiles + streaks rows using metadata usernames.
--
-- Set your own password here (bcrypt-hashed at seed time, never stored plain):
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  md5('piqa-seed-user-' || i)::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  case
    when i <= 4 then 'house' || i || '@joinpiqa.com'
    else 'seed' || lpad(i::text, 2, '0') || '@joinpiqa.com'
  end,
  extensions.crypt('CHANGE_ME_before_seeding', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username',
    case i
      when 1 then 'liwanag'
      when 2 then 'kodachrome'
      when 3 then 'streetgrain'
      when 4 then 'goldenhour'
      else 'shooter' || lpad(i::text, 2, '0')
    end),
  now(), now(), '', '', '', ''
from generate_series(1, 30) as i
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  u.id::text,
  now(), now(), now()
from auth.users u
where u.email like '%@joinpiqa.com'
  and not exists (
    select 1 from auth.identities x
    where x.provider = 'email' and x.provider_id = u.id::text
  );

-- ---------------------------------------------------------------------------
-- Today's prompt + BETA drop: 7pm Manila drop, midnight submit close, 8am vote close
-- ---------------------------------------------------------------------------
insert into public.prompts (id, text, category, used_at)
values (
  md5('piqa-seed-prompt-1')::uuid,
  'Something red within reach',
  'color',
  (now() at time zone 'Asia/Manila')::date
)
on conflict (id) do nothing;

insert into public.prompt_drops
  (id, prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
select
  md5('piqa-seed-drop-1')::uuid,
  md5('piqa-seed-prompt-1')::uuid,
  'BETA',
  d,
  ((d + time '19:00') at time zone 'Asia/Manila'),
  (((d + 1) + time '00:00') at time zone 'Asia/Manila'),
  (((d + 1) + time '08:00') at time zone 'Asia/Manila'),
  case when now() >= ((d + time '19:00') at time zone 'Asia/Manila')
       then 'live' else 'scheduled' end
from (select (now() at time zone 'Asia/Manila')::date as d) t
on conflict (region, drop_date) do nothing;

-- ---------------------------------------------------------------------------
-- 30 submissions — one per seed user, captured 3–170 min after the drop,
-- plausible vote counts (4–21) and ratings loosely tracking them.
-- Storage objects intentionally don't exist yet; tiles render as skeletons.
-- ---------------------------------------------------------------------------
insert into public.submissions
  (id, drop_id, user_id, image_path, thumb_path, captured_at,
   rating, vote_count, quick_draw)
select
  md5('piqa-seed-submission-' || i)::uuid,
  d.id,
  md5('piqa-seed-user-' || i)::uuid,
  d.id::text || '/' || md5('piqa-seed-user-' || i) || '.jpg',
  d.id::text || '/' || md5('piqa-seed-user-' || i) || '_thumb.jpg',
  d.drops_at + make_interval(mins => mins.m),
  1000 + (vc.v - 12) * 15 + floor(random() * 80 - 40)::int,
  vc.v,
  mins.m <= 30
from generate_series(1, 30) as i
cross join lateral (select id, drops_at from public.prompt_drops
                    where id = md5('piqa-seed-drop-1')::uuid) d
cross join lateral (select (4 + floor(random() * 18))::int as v) vc
cross join lateral (select (3 + floor(random() * 167))::int as m) mins
on conflict (drop_id, user_id) do nothing;
