-- Phase 3: Studios — friend groups (spec §11c, docs/design-review/07-studios-screen.html).
-- Schema + RPCs only, deployed inert behind the `studios_enabled` config flag (client
-- gate; see lib/services/config.ts). Studios reads off the SAME global gallery
-- everyone else's photo lives in — there is no Studio-only vote, ever, and the
-- standing line is an anonymous aggregate ("N of M made today's gallery"), never a
-- ranked list of members (the same fairness law that governs the main gallery).
-- Single-studio membership per user for this design (see report 7 §"Open decisions").
-- The client never queries these tables directly — RPC-only, matching the rest of
-- the schema (see 20260721000002_rename_subjects.sql's own note on subject_drops).

create table public.studios (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 40),
  invite_code  text not null unique,
  director_id  uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- user_id as the PK (not a composite key) enforces single-studio membership at the
-- schema level — no app-side race between "check then insert".
create table public.studio_members (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  studio_id    uuid not null references public.studios (id) on delete cascade,
  joined_at    timestamptz not null default now()
);
create index studio_members_studio_idx on public.studio_members (studio_id);

alter table public.studios        enable row level security;
alter table public.studio_members enable row level security;
-- No policies on purpose: every read/write goes through a security-definer RPC
-- below, so direct client access to these tables stays fully denied.

insert into public.config (key, value) values
  ('studios_enabled',    'false'),
  ('studio_member_cap',  '8')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Invite codes: 6 chars, uppercase, digits+letters minus visually-ambiguous
-- 0/O/1/I/L, retried on the rare collision.
-- ---------------------------------------------------------------------------
create or replace function public.generate_studio_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.studios where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_studio(name) — you + this Studio, as Director. One Studio at a time.
-- ---------------------------------------------------------------------------
create or replace function public.create_studio(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text := trim(p_name);
  new_id uuid;
  code text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.studio_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 40 then
    return jsonb_build_object('ok', false, 'reason', 'bad_name');
  end if;

  code := public.generate_studio_code();

  insert into public.studios (name, invite_code, director_id)
  values (clean_name, code, uid)
  returning id into new_id;

  insert into public.studio_members (user_id, studio_id) values (uid, new_id);

  return jsonb_build_object('ok', true, 'studio_id', new_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- join_studio_by_code(code) — redeem an invite code. Capped at studio_member_cap.
-- ---------------------------------------------------------------------------
create or replace function public.join_studio_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.studios%rowtype;
  cap int := public.cfg_int('studio_member_cap', 8);
  member_count int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.studio_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end if;

  select * into target from public.studios
    where invite_code = upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  if target.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select count(*) into member_count from public.studio_members where studio_id = target.id;
  if member_count >= cap then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  insert into public.studio_members (user_id, studio_id) values (uid, target.id);

  return jsonb_build_object('ok', true, 'studio_id', target.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_studio() — the Standing view's one call: identity, face-pile preview,
-- anonymous-aggregate standing, and a shared streak. Region is anchored on the
-- Director's profile — every user is 'BETA' today (single-region beta), so this
-- doesn't yet need to reconcile members across regions; revisit if that changes.
-- ---------------------------------------------------------------------------
create or replace function public.get_studio()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.studios%rowtype;
  v_region text;
  member_count int;
  made_count int;
  latest_drop record;
  streak_days int := 0;
  d record;
  hit boolean;
  members_preview jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select s.* into st from public.studios s
    join public.studio_members sm on sm.studio_id = s.id
    where sm.user_id = uid;
  if st.id is null then
    return jsonb_build_object('found', false);
  end if;

  select region into v_region from public.profiles where id = st.director_id;
  select count(*) into member_count from public.studio_members where studio_id = st.id;

  select coalesce(jsonb_agg(
           jsonb_build_object('id', pr.id, 'username', pr.username, 'avatar_url', pr.avatar_url)
           order by (pr.id = st.director_id) desc, sm.joined_at asc
         ), '[]'::jsonb)
    into members_preview
  from public.studio_members sm
  join public.profiles pr on pr.id = sm.user_id
  where sm.studio_id = st.id;

  -- Standing: the latest revealed drop in the anchor region, and how many
  -- members' shots made that gallery. Never a ranked list — a single aggregate.
  select pd.id, pd.drop_date into latest_drop
  from public.subject_drops pd
  where pd.region = v_region and pd.status = 'revealed'
  order by pd.drop_date desc
  limit 1;

  made_count := 0;
  if latest_drop.id is not null then
    select count(*) into made_count
    from public.submissions s
    join public.studio_members sm on sm.user_id = s.user_id
    where sm.studio_id = st.id and s.drop_id = latest_drop.id and s.in_gallery;
  end if;

  -- Shared streak: consecutive revealed days (most recent first) where at least
  -- one member submitted a daily shot. Capped at 120 days back so this can never
  -- run away on old data.
  for d in
    select pd.id, pd.drop_date
    from public.subject_drops pd
    where pd.region = v_region and pd.status = 'revealed'
    order by pd.drop_date desc
    limit 120
  loop
    select exists (
      select 1 from public.submissions s
      join public.studio_members sm on sm.user_id = s.user_id
      where sm.studio_id = st.id and s.drop_id = d.id and s.thumb_path is not null
    ) into hit;
    exit when not hit;
    streak_days := streak_days + 1;
  end loop;

  return jsonb_build_object(
    'found', true,
    'id', st.id,
    'name', st.name,
    'invite_code', st.invite_code,
    'is_director', st.director_id = uid,
    'member_count', member_count,
    'members_preview', members_preview,
    'standing_made', made_count,
    'standing_of', member_count,
    'streak_days', streak_days
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_studio_members() — the unordered roster (director/join-order, never
-- resorted by performance). Each row's presence mark is "shot today: yes/no" —
-- never a count, a placement, or anything comparable between members.
-- ---------------------------------------------------------------------------
create or replace function public.get_studio_members()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  result jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select studio_id into sid from public.studio_members where user_id = uid;
  if sid is null then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', pr.id,
             'username', pr.username,
             'avatar_url', pr.avatar_url,
             'role', case when pr.id = s.director_id then 'director' else 'member' end,
             'submitted_today', exists (
               select 1
               from public.subject_drops pd
               join public.submissions sub
                 on sub.drop_id = pd.id and sub.user_id = pr.id and sub.thumb_path is not null
               where pd.region = pr.region
                 and now() >= pd.drops_at and now() < pd.submit_closes_at
             )
           )
           order by (pr.id = s.director_id) desc, sm.joined_at asc
         ), '[]'::jsonb)
    into result
  from public.studio_members sm
  join public.profiles pr on pr.id = sm.user_id
  join public.studios s on s.id = sm.studio_id
  where sm.studio_id = sid;

  return jsonb_build_object('found', true, 'members', result);
end;
$$;

-- ---------------------------------------------------------------------------
-- rename_studio(name) — Director only.
-- ---------------------------------------------------------------------------
create or replace function public.rename_studio(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text := trim(p_name);
  sid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 40 then
    return jsonb_build_object('ok', false, 'reason', 'bad_name');
  end if;

  select id into sid from public.studios where director_id = uid;
  if sid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_director');
  end if;

  update public.studios set name = clean_name where id = sid;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_studio_member(user) — Director only; can't remove yourself this way
-- (that's delete_studio, which takes the whole Studio down with you).
-- ---------------------------------------------------------------------------
create or replace function public.remove_studio_member(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_user = uid then
    return jsonb_build_object('ok', false, 'reason', 'cant_remove_self');
  end if;

  select id into sid from public.studios where director_id = uid;
  if sid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_director');
  end if;

  delete from public.studio_members where user_id = p_user and studio_id = sid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_studio() — any non-director member. The Director must delete_studio()
-- instead (no ownership handoff in this design — see report 7).
-- ---------------------------------------------------------------------------
create or replace function public.leave_studio()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.studios where director_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'director_must_delete');
  end if;

  delete from public.studio_members where user_id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_studio() — Director only. Cascades the membership rows.
-- ---------------------------------------------------------------------------
create or replace function public.delete_studio()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select id into sid from public.studios where director_id = uid;
  if sid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_director');
  end if;

  delete from public.studios where id = sid;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.generate_studio_code()          from public, anon;
revoke execute on function public.create_studio(text)              from public, anon;
revoke execute on function public.join_studio_by_code(text)        from public, anon;
revoke execute on function public.get_studio()                     from public, anon;
revoke execute on function public.get_studio_members()             from public, anon;
revoke execute on function public.rename_studio(text)               from public, anon;
revoke execute on function public.remove_studio_member(uuid)        from public, anon;
revoke execute on function public.leave_studio()                    from public, anon;
revoke execute on function public.delete_studio()                   from public, anon;

grant execute on function public.create_studio(text)              to authenticated;
grant execute on function public.join_studio_by_code(text)         to authenticated;
grant execute on function public.get_studio()                      to authenticated;
grant execute on function public.get_studio_members()               to authenticated;
grant execute on function public.rename_studio(text)                to authenticated;
grant execute on function public.remove_studio_member(uuid)         to authenticated;
grant execute on function public.leave_studio()                     to authenticated;
grant execute on function public.delete_studio()                    to authenticated;
