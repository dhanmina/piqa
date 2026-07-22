-- Notification wiring (server half). Future-proof + decoupled: a polling sweeper
-- with idempotent flags, NOT edits to close_day/drop_prompt, so notifications can
-- never break the core game loop. Everything is best-effort and EXCEPTION-SAFE:
-- a push failure never raises, never blocks a follow, never errors the cron.
--
-- Delivery is inert until BOTH are in place (then it just starts working):
--   1. FCM configured in EAS + a build that registers push tokens (profiles.push_token).
--   2. The service_role key stored in Vault as 'service_role_key' (see README note below):
--        select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
-- Until (2), send_push() no-ops. Rotating the key = update the Vault secret only.
--
-- Path: trigger/cron -> send_push() -> pg_net POST -> public.push edge function ->
-- Expo Push API. Tokens never leave the backend (the edge function resolves them).

-- 1) Idempotency flags on drops (so each drop is announced/revealed exactly once).
alter table public.subject_drops add column if not exists live_notified_at   timestamptz;
alter table public.subject_drops add column if not exists reveal_notified_at timestamptz;

-- 2) send_push — the one place that talks to the push edge function. Reads the
--    service key from Vault; if absent, it is a silent no-op. Wrapped so it can
--    NEVER raise into its caller (a follow insert, the sweeper).
create or replace function public.send_push(
  p_title    text,
  p_body     text,
  p_data     jsonb   default '{}'::jsonb,
  p_region   text    default null,
  p_user_ids uuid[]  default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  svc  text;
  body jsonb;
begin
  select decrypted_secret into svc
    from vault.decrypted_secrets
   where name = 'service_role_key'
   limit 1;
  if svc is null or svc = '' then
    return; -- not configured yet -> no-op (inert)
  end if;

  body := jsonb_build_object('title', p_title, 'body', p_body, 'data', coalesce(p_data, '{}'::jsonb));
  if p_region   is not null then body := body || jsonb_build_object('region',  p_region); end if;
  if p_user_ids is not null then body := body || jsonb_build_object('userIds', to_jsonb(p_user_ids)); end if;

  perform net.http_post(
    url     := 'https://eppbhvhmyibhyhilombx.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc),
    body    := body
  );
exception when others then
  -- best-effort: a push must never break the thing that triggered it
  raise notice 'send_push failed: %', sqlerrm;
end;
$$;

revoke execute on function public.send_push(text, text, jsonb, text, uuid[]) from public, anon, authenticated;

-- 3) The sweeper — announces newly-live drops and newly-revealed galleries, once
--    each, per region. Idempotent via the flags. Each item is guarded so one bad
--    row never stops the rest.
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
  -- Drop is live: the day's Subject just opened for capture.
  for d in
    select id, region from public.subject_drops
    where drops_at <= now() and live_notified_at is null and status in ('scheduled', 'live')
  loop
    begin
      perform public.send_push(
        'A new Subject is live',
        'Today''s shot is waiting. Go capture it.',
        jsonb_build_object('type', 'drop'),
        d.region, null
      );
      update public.subject_drops set live_notified_at = now() where id = d.id;
      n := n + 1;
    exception when others then
      raise notice 'notify live % failed: %', d.id, sqlerrm;
    end;
  end loop;

  -- Gallery revealed: results are in, plus a personal crown for the winner.
  for d in
    select id, region from public.subject_drops
    where status = 'revealed' and reveal_notified_at is null
  loop
    begin
      perform public.send_push(
        'The gallery is live',
        'See who made it, and today''s Photo of the Day.',
        jsonb_build_object('type', 'reveal'),
        d.region, null
      );
      perform public.send_push(
        'Photo of the Day',
        'Your shot was crowned. Tap to see it.',
        jsonb_build_object('type', 'potd'),
        null,
        array(select user_id from public.submissions where drop_id = d.id and is_potd)
      );
      update public.subject_drops set reveal_notified_at = now() where id = d.id;
      n := n + 1;
    exception when others then
      raise notice 'notify reveal % failed: %', d.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'processed', n);
end;
$$;

revoke execute on function public.notify_pending() from public, anon, authenticated;

-- 4) Follow -> notify the followee the moment it happens (low volume, immediate).
create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  select username into uname from public.profiles where id = new.follower_id;
  perform public.send_push(
    'New follower',
    coalesce(uname, 'Someone') || ' started following you.',
    jsonb_build_object('type', 'follow', 'userId', new.follower_id),
    null,
    array[new.followee_id]
  );
  return new;
exception when others then
  return new; -- never block a follow on a push
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_follow();

-- 5) Run the sweeper every 2 minutes (idempotent, so this cadence is safe). This
--    covers the randomized 06:00-07:00 drops_at and the hourly reveal sweep with
--    at most a ~2 min delay.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'piqa-notify') then
    perform cron.unschedule('piqa-notify');
  end if;
  perform cron.schedule('piqa-notify', '*/2 * * * *', $cron$ select public.notify_pending(); $cron$);
exception when others then
  raise notice 'piqa-notify scheduling skipped: %', sqlerrm;
end;
$$;
