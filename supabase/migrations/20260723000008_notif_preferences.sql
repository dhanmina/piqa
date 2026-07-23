-- Notifications Phase A: preferences + quiet hours + batched appreciation.
-- See docs/notification-plan.md. Makes push preference-aware so users control it
-- (the anti-annoyance layer), tags every push with a category, adds made-gallery
-- + a daily appreciation digest. All OTA-class.

-- 1) Per-user prefs. Default ON (valuable out of the box) with quiet hours
--    21:00-08:00 local so nobody gets an overnight buzz.
alter table public.profiles
  add column if not exists notif_daily        boolean not null default true,
  add column if not exists notif_results      boolean not null default true,
  add column if not exists notif_wins         boolean not null default true,
  add column if not exists notif_appreciation boolean not null default true,
  add column if not exists notif_social        boolean not null default true,
  add column if not exists quiet_start time,
  add column if not exists quiet_end   time;

update public.profiles
  set quiet_start = time '21:00', quiet_end = time '08:00'
  where quiet_start is null and quiet_end is null;

-- 2) Is it currently quiet hours for this user (in THEIR timezone)? Handles the
--    overnight wrap (21:00 -> 08:00). Null window = never quiet.
create or replace function public.in_quiet_hours(p_qs time, p_qe time, p_tz text)
returns boolean
language sql
stable
as $$
  select case
    when p_qs is null or p_qe is null then false
    when p_qs < p_qe then
      (now() at time zone coalesce(p_tz, 'Asia/Manila'))::time >= p_qs
      and (now() at time zone coalesce(p_tz, 'Asia/Manila'))::time < p_qe
    else
      (now() at time zone coalesce(p_tz, 'Asia/Manila'))::time >= p_qs
      or (now() at time zone coalesce(p_tz, 'Asia/Manila'))::time < p_qe
  end;
$$;

-- 3) send_push, now preference-aware. Resolves the ELIGIBLE tokens itself
--    (category flag on + not in quiet hours, per recipient) and passes them
--    explicitly, so the edge function needs no change. p_category null = no filter.
drop function if exists public.send_push(text, text, jsonb, text, uuid[]);
create or replace function public.send_push(
  p_title    text,
  p_body     text,
  p_data     jsonb   default '{}'::jsonb,
  p_region   text    default null,
  p_user_ids uuid[]  default null,
  p_category text    default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  svc  text;
  toks text[];
  body jsonb;
begin
  select decrypted_secret into svc
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if svc is null or svc = '' then return; end if;

  select array_agg(pr.push_token) into toks
  from public.profiles pr
  where pr.push_token is not null
    and (
      (p_region   is not null and pr.region = p_region)
      or (p_user_ids is not null and pr.id = any (p_user_ids))
    )
    -- category preference (null category => send to all)
    and (p_category is null or case p_category
          when 'daily'        then pr.notif_daily
          when 'results'      then pr.notif_results
          when 'wins'         then pr.notif_wins
          when 'appreciation' then pr.notif_appreciation
          when 'social'       then pr.notif_social
          else true end)
    -- quiet hours, in the recipient's own timezone
    and not public.in_quiet_hours(pr.quiet_start, pr.quiet_end, pr.timezone);

  if toks is null or array_length(toks, 1) = 0 then return; end if;

  body := jsonb_build_object(
    'title', p_title, 'body', p_body,
    'data', coalesce(p_data, '{}'::jsonb),
    'tokens', to_jsonb(toks)
  );

  perform net.http_post(
    url     := 'https://eppbhvhmyibhyhilombx.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc),
    body    := body
  );
exception when others then
  raise notice 'send_push failed: %', sqlerrm;
end;
$$;
revoke execute on function public.send_push(text, text, jsonb, text, uuid[], text) from public, anon, authenticated;

-- 4) Sweeper: category-tagged, plus a made-the-gallery push for placers.
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
      update public.subject_drops set reveal_notified_at = now() where id = d.id;
      n := n + 1;
    exception when others then raise notice 'notify reveal % failed: %', d.id, sqlerrm; end;
  end loop;

  return jsonb_build_object('ok', true, 'processed', n);
end;
$$;
revoke execute on function public.notify_pending() from public, anon, authenticated;

-- 5) Follow -> social category.
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
  return new;
exception when others then return new; end;
$$;

-- 6) Daily appreciation digest — ONE batched push per photographer for the day's
--    hearts + nods (never per-event, §8). Runs at 12:00 UTC = 20:00 Manila.
create or replace function public.notify_appreciation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select s.user_id as uid, count(*) as cnt
    from (
      select submission_id from public.reactions where created_at > now() - interval '24 hours'
      union all
      select submission_id from public.nods      where created_at > now() - interval '24 hours'
    ) x
    join public.submissions s on s.id = x.submission_id
    group by s.user_id
  loop
    begin
      perform public.send_push(
        'Curators noticed you',
        r.cnt || case when r.cnt = 1 then ' curator appreciated your shot today.'
                      else ' curators appreciated your shots today.' end,
        jsonb_build_object('type', 'appreciation'),
        null, array[r.uid], 'appreciation'
      );
      n := n + 1;
    exception when others then raise notice 'appreciation % failed: %', r.uid, sqlerrm; end;
  end loop;
  return jsonb_build_object('ok', true, 'sent', n);
end;
$$;
revoke execute on function public.notify_appreciation() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'piqa-appreciation') then
    perform cron.unschedule('piqa-appreciation');
  end if;
  perform cron.schedule('piqa-appreciation', '0 12 * * *', $cron$ select public.notify_appreciation(); $cron$);
exception when others then raise notice 'piqa-appreciation scheduling skipped: %', sqlerrm;
end;
$$;

-- 7) Client read/write of prefs (column grants stay locked; go through RPCs).
create or replace function public.get_notification_prefs()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'daily', p.notif_daily, 'results', p.notif_results, 'wins', p.notif_wins,
    'appreciation', p.notif_appreciation, 'social', p.notif_social,
    'quiet', (p.quiet_start is not null and p.quiet_end is not null)
  )
  from public.profiles p where p.id = auth.uid();
$$;
revoke execute on function public.get_notification_prefs() from public, anon;
grant  execute on function public.get_notification_prefs() to authenticated;

create or replace function public.update_notification_prefs(
  p_daily boolean, p_results boolean, p_wins boolean,
  p_appreciation boolean, p_social boolean, p_quiet boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.profiles set
    notif_daily = p_daily, notif_results = p_results, notif_wins = p_wins,
    notif_appreciation = p_appreciation, notif_social = p_social,
    quiet_start = case when p_quiet then time '21:00' else null end,
    quiet_end   = case when p_quiet then time '08:00' else null end
  where id = auth.uid();
end;
$$;
revoke execute on function public.update_notification_prefs(boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant  execute on function public.update_notification_prefs(boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
