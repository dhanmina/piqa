-- Studio challenge nudge: the escape valve for the Director-only start gate.
-- Director stays the sole decision-maker (start_studio_challenge is unchanged),
-- but a non-Director can ping them instead of hitting a dead end. Rate-limited
-- to one nudge per member per Studio per day. RPC-only, same as
-- studios/studio_members/studio_challenges — zero policies on the table itself.

create table public.studio_challenge_nudges (
  id         uuid primary key default gen_random_uuid(),
  studio_id  uuid not null references public.studios (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index studio_challenge_nudges_lookup_idx
  on public.studio_challenge_nudges (studio_id, user_id, created_at desc);

alter table public.studio_challenge_nudges enable row level security;

-- ---------------------------------------------------------------------------
-- nudge_studio_director() — any non-Director member, once per day, only while
-- no challenge is currently running. Pushes to the Director under the 'social'
-- category (same bucket as "new follower"), so existing notif prefs govern it.
-- ---------------------------------------------------------------------------
create or replace function public.nudge_studio_director()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  sid   uuid;
  did   uuid;
  uname text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select sm.studio_id, s.director_id into sid, did
  from public.studio_members sm
  join public.studios s on s.id = sm.studio_id
  where sm.user_id = uid;

  if sid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_in_studio');
  end if;
  if did = uid then
    return jsonb_build_object('ok', false, 'reason', 'is_director');
  end if;

  if exists (
    select 1 from public.studio_challenges
    where studio_id = sid and ends_at > now()
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_active');
  end if;

  if exists (
    select 1 from public.studio_challenge_nudges
    where studio_id = sid and user_id = uid and created_at > now() - interval '1 day'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_nudged');
  end if;

  insert into public.studio_challenge_nudges (studio_id, user_id) values (sid, uid);

  select username into uname from public.profiles where id = uid;
  perform public.send_push(
    'Studio challenge idea',
    coalesce(uname, 'Someone') || ' wants a Studio challenge — start one?',
    jsonb_build_object('type', 'studio_challenge_nudge'),
    null, array[did], 'social'
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.nudge_studio_director() from public, anon;
grant  execute on function public.nudge_studio_director() to authenticated;
