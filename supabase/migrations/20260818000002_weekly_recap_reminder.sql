-- Weekly recap re-engagement push (Growth loops). Positive-only (Law 3): a
-- shot_count of 0 marks the week checked without sending anything — no point
-- re-engaging with an empty recap. Folded into the existing notify_pending()
-- 2-min sweep rather than a new pg_cron schedule (see the pg_cron scheduler
-- gotcha in project notes: fewer schedules is safer), gated per-profile on
-- their own timezone so it lands Sunday morning locally, same philosophy as
-- quiet hours and per-region drops.

alter table public.profiles
  add column if not exists notif_weekly_recap boolean not null default true;

alter table public.profiles
  add column if not exists last_recap_notified_at timestamptz;

-- send_push: one more category branch. Signature unchanged, plain replace.
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
          when 'daily'         then pr.notif_daily
          when 'results'       then pr.notif_results
          when 'wins'          then pr.notif_wins
          when 'appreciation'  then pr.notif_appreciation
          when 'social'        then pr.notif_social
          when 'closing_soon'  then pr.notif_closing_soon
          when 'weekly_recap'  then pr.notif_weekly_recap
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

-- notify_pending: add the weekly-recap sweep as a 4th loop.
create or replace function public.notify_pending()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  r record;
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

  -- Submission window closing soon: live, within 30min of submit_closes_at,
  -- only to those who haven't submitted today (a "don't lose your streak"
  -- nudge, not a drop-time reveal).
  for d in
    select id, region from public.subject_drops
    where status = 'live'
      and closing_notified_at is null
      and submit_closes_at > now()
      and submit_closes_at <= now() + interval '30 minutes'
  loop
    begin
      perform public.send_push(
        'Submissions closing soon',
        'Your streak is on the line — get today''s shot in before it closes.',
        jsonb_build_object('type', 'closing_soon'),
        null,
        array(
          select pr.id from public.profiles pr
          where pr.region = d.region
            and not exists (
              select 1 from public.submissions s where s.drop_id = d.id and s.user_id = pr.id
            )
        ),
        'closing_soon'
      );
      update public.subject_drops set closing_notified_at = now() where id = d.id;
      n := n + 1;
    exception when others then raise notice 'notify closing_soon % failed: %', d.id, sqlerrm; end;
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

  -- Weekly recap: Sunday, 9am local, once every ~6 days, positive-only.
  -- get_weekly_recap() is a rolling trailing-7-day window computed at read
  -- time, so any Sunday-morning fire always summarizes the right span.
  for r in
    select pr.id
    from public.profiles pr
    where pr.notif_weekly_recap
      and pr.push_token is not null
      and (pr.last_recap_notified_at is null or pr.last_recap_notified_at < now() - interval '6 days')
      and extract(dow from now() at time zone coalesce(pr.timezone, 'UTC')) = 0
      and extract(hour from now() at time zone coalesce(pr.timezone, 'UTC')) = 9
  loop
    begin
      if coalesce((public.get_weekly_recap(r.id)->>'shot_count')::int, 0) > 0 then
        perform public.send_push(
          'Your week in prints',
          'See your best shot and stats from the last 7 days.',
          jsonb_build_object('type', 'weekly_recap'),
          null, array[r.id], 'weekly_recap'
        );
        n := n + 1;
      end if;
      -- Mark checked either way — an empty week still shouldn't be rechecked
      -- every 2 minutes for the rest of the day.
      update public.profiles set last_recap_notified_at = now() where id = r.id;
    exception when others then raise notice 'notify weekly_recap % failed: %', r.id, sqlerrm; end;
  end loop;

  return jsonb_build_object('ok', true, 'processed', n);
end;
$$;
revoke execute on function public.notify_pending() from public, anon, authenticated;

-- Client read/write of prefs — add weekly_recap alongside the existing six.
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
    'closingSoon', p.notif_closing_soon,
    'weeklyRecap', p.notif_weekly_recap,
    'quiet', (p.quiet_start is not null and p.quiet_end is not null)
  )
  from public.profiles p where p.id = auth.uid();
$$;

drop function if exists public.update_notification_prefs(boolean, boolean, boolean, boolean, boolean, boolean, boolean);
create or replace function public.update_notification_prefs(
  p_daily boolean, p_results boolean, p_wins boolean,
  p_appreciation boolean, p_social boolean, p_quiet boolean,
  p_closing_soon boolean default true,
  p_weekly_recap boolean default true
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
    notif_closing_soon = p_closing_soon,
    notif_weekly_recap = p_weekly_recap,
    quiet_start = case when p_quiet then time '21:00' else null end,
    quiet_end   = case when p_quiet then time '08:00' else null end
  where id = auth.uid();
end;
$$;
revoke execute on function public.update_notification_prefs(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant  execute on function public.update_notification_prefs(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
