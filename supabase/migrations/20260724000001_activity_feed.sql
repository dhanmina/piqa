-- Activity feed (the in-app notification inbox). The push pipeline
-- (20260722000002_notifications_wiring, 20260723000008_notif_preferences) is
-- fire-and-forget: an OS banner that vanishes. This persists the PERSONAL half of
-- those same events so the appreciation your work earns has a home you can pull
-- open from the Today bell, even with push off or the banner dismissed.
--
-- Scope is deliberately the four "about you" kinds only — potd, win (made the
-- gallery), appreciation (hearts + nods), follow. Global announcements (a new
-- Subject, the reveal) stay OUT: they are already carried by the Today/Gallery
-- tab dots + push, and mixing them in would bury the payoff under system noise.
--
-- Everything that writes a row is best-effort and exception-safe (same law as
-- send_push): a feed insert must NEVER break a heart, a follow, or the reveal
-- sweeper. All rows are written by security-definer functions; clients only read.

-- 1) The feed table. No `body` text: copy is built at read time in get_activity
--    so wording can change without a migration. event_count aggregates a day's
--    hearts+nods per shot into one calm row ("5 curators appreciated…").
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade, -- recipient
  kind          text not null check (kind in ('potd','win','appreciation','follow')),
  actor_id      uuid references public.profiles(id) on delete cascade,          -- follower (follow only)
  submission_id uuid references public.submissions(id) on delete cascade,        -- the shot (potd/win/appreciation)
  drop_id       uuid references public.subject_drops(id) on delete cascade,
  event_count   integer not null default 1,                                      -- hearts+nods rolled up (appreciation)
  created_at    timestamptz not null default now(),
  seen_at       timestamptz
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
-- One appreciation row per (recipient, shot): new hearts/nods bump it, never pile up.
create unique index if not exists notifications_appreciation_uq
  on public.notifications (user_id, submission_id) where kind = 'appreciation';
-- One follow row per (recipient, follower): a re-follow bumps the same row.
create unique index if not exists notifications_follow_uq
  on public.notifications (user_id, actor_id) where kind = 'follow';

alter table public.notifications enable row level security;
-- Read-only to owners; all writes go through the definer functions below.
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- 2) Appreciation: one row per shot, bumped on each heart/nod. Skips self-love and
--    resurfaces (seen_at = null) so genuinely-new appreciation nudges again.
create or replace function public.record_appreciation(p_submission uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid; v_drop uuid;
begin
  select user_id, drop_id into v_owner, v_drop from public.submissions where id = p_submission;
  if v_owner is null or v_owner = p_actor then return; end if; -- no shot, or your own
  insert into public.notifications (user_id, kind, submission_id, drop_id, event_count)
  values (v_owner, 'appreciation', p_submission, v_drop, 1)
  on conflict (user_id, submission_id) where kind = 'appreciation'
  do update set event_count = notifications.event_count + 1,
                created_at  = now(),
                seen_at     = null;
exception when others then
  raise notice 'record_appreciation failed: %', sqlerrm;
end;
$$;
revoke execute on function public.record_appreciation(uuid, uuid) from public, anon, authenticated;

create or replace function public.trg_reaction_appreciation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_appreciation(new.submission_id, new.user_id);
  return new;
exception when others then return new; -- never block a heart
end;
$$;

create or replace function public.trg_nod_appreciation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_appreciation(new.submission_id, new.curator_id);
  return new;
exception when others then return new; -- never block a nod
end;
$$;

drop trigger if exists reactions_appreciation on public.reactions;
create trigger reactions_appreciation
  after insert on public.reactions
  for each row execute function public.trg_reaction_appreciation();

drop trigger if exists nods_appreciation on public.nods;
create trigger nods_appreciation
  after insert on public.nods
  for each row execute function public.trg_nod_appreciation();

-- 3) notify_pending: unchanged push behaviour, plus a potd/win feed row per placer.
--    The reveal block is already idempotent (reveal_notified_at), so a plain
--    insert here runs exactly once per drop — no de-dupe needed.
create or replace function public.notify_pending()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  n int := 0;
begin
  -- Drop is live.
  for d in
    select id, region from public.subject_drops
    where drops_at <= now() and live_notified_at is null and status in ('scheduled', 'live')
  loop
    begin
      perform public.send_push(
        'A new Subject is live',
        'Today''s shot is waiting. Go capture it.',
        jsonb_build_object('type', 'drop'),
        d.region, null, 'daily'
      );
      update public.subject_drops set live_notified_at = now() where id = d.id;
      n := n + 1;
    exception when others then raise notice 'notify live % failed: %', d.id, sqlerrm; end;
  end loop;

  -- Gallery revealed: results (everyone) + PotD crown + made-the-gallery (placers).
  for d in
    select id, region from public.subject_drops
    where status = 'revealed' and reveal_notified_at is null
  loop
    begin
      perform public.send_push(
        'The gallery is live',
        'See who made it, and today''s Photo of the Day.',
        jsonb_build_object('type', 'reveal'),
        d.region, null, 'results'
      );
      perform public.send_push(
        'Photo of the Day',
        'Your shot was crowned. Tap to see it.',
        jsonb_build_object('type', 'potd'),
        null,
        array(select user_id from public.submissions where drop_id = d.id and is_potd),
        'wins'
      );
      perform public.send_push(
        'You made the gallery',
        'Your shot made today''s gallery. Tap to see it.',
        jsonb_build_object('type', 'gallery'),
        null,
        array(select user_id from public.submissions where drop_id = d.id and in_gallery and not is_potd),
        'wins'
      );
      -- Feed rows (personal inbox) — best-effort, never blocks the reveal sweep.
      begin
        insert into public.notifications (user_id, kind, submission_id, drop_id)
        select user_id, 'potd', id, drop_id
          from public.submissions where drop_id = d.id and is_potd;
        insert into public.notifications (user_id, kind, submission_id, drop_id)
        select user_id, 'win', id, drop_id
          from public.submissions where drop_id = d.id and in_gallery and not is_potd;
      exception when others then raise notice 'notify feed % failed: %', d.id, sqlerrm; end;

      update public.subject_drops set reveal_notified_at = now() where id = d.id;
      n := n + 1;
    exception when others then raise notice 'notify reveal % failed: %', d.id, sqlerrm; end;
  end loop;

  return jsonb_build_object('ok', true, 'processed', n);
end;
$$;
revoke execute on function public.notify_pending() from public, anon, authenticated;

-- 4) notify_follow: unchanged push, plus a de-duped follow feed row (a re-follow
--    bumps the same row back to unseen instead of stacking).
create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uname text;
begin
  select username into uname from public.profiles where id = new.follower_id;
  perform public.send_push(
    'New follower',
    coalesce(uname, 'Someone') || ' started following you.',
    jsonb_build_object('type', 'follow', 'userId', new.follower_id),
    null, array[new.followee_id], 'social'
  );
  begin
    insert into public.notifications (user_id, kind, actor_id)
    values (new.followee_id, 'follow', new.follower_id)
    on conflict (user_id, actor_id) where kind = 'follow'
    do update set created_at = now(), seen_at = null;
  exception when others then raise notice 'notify follow feed failed: %', sqlerrm; end;
  return new;
exception when others then return new; -- never block a follow
end;
$$;

-- 5) Read the caller's feed, newest first, copy built here (not stored). thumb_path
--    is a private path the client signs; avatar_url is a public URL used as-is.
create or replace function public.get_activity(p_before timestamptz default null, p_limit int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  from (
    select
      n.id,
      n.kind,
      n.created_at,
      (n.seen_at is not null) as seen,
      n.event_count,
      case when n.kind = 'follow' and ap.id is not null
           then jsonb_build_object('id', ap.id, 'username', ap.username, 'avatar_url', ap.avatar_url)
           else null end as actor,
      sub.thumb_path as thumb_path,
      subj.text      as subject
    from public.notifications n
    left join public.profiles     ap   on ap.id   = n.actor_id
    left join public.submissions  sub  on sub.id  = n.submission_id
    left join public.subject_drops sd  on sd.id   = n.drop_id
    left join public.subjects     subj on subj.id = sd.prompt_id
    where n.user_id = auth.uid()
      and (p_before is null or n.created_at < p_before)
    order by n.created_at desc
    limit least(coalesce(p_limit, 30), 100)
  ) r;
$$;
revoke execute on function public.get_activity(timestamptz, int) from public, anon;
grant  execute on function public.get_activity(timestamptz, int) to authenticated;

-- 6) Mark everything read (the calm dot clears the moment the inbox opens).
create or replace function public.mark_activity_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set seen_at = now()
  where user_id = auth.uid() and seen_at is null;
$$;
revoke execute on function public.mark_activity_seen() from public, anon;
grant  execute on function public.mark_activity_seen() to authenticated;

-- 7) Cheap unread flag for the Today bell dot (indexed EXISTS, no join).
create or replace function public.get_activity_unread()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.notifications
    where user_id = auth.uid() and seen_at is null
  );
$$;
revoke execute on function public.get_activity_unread() from public, anon;
grant  execute on function public.get_activity_unread() to authenticated;
