-- Phase 3 · Scheduled loop (spec §14 crons).
--
-- drop_prompt(): create the day's BETA drop with a randomized drops_at inside
--   the region window, pick an unused prompt, set submit/voting close times.
--   (Push fan-out is a TODO — real FCM lands in Phase 4.)
-- close_due_drops(): sweeper that closes any drop whose voting window has
--   elapsed but hasn't been revealed — the production path to close_day without
--   per-region cron math. Runs hourly.
--
-- Region window for BETA is Manila local (spec §16: known-good evening drop).

create or replace function public.drop_prompt(p_region text default 'BETA')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  chosen record;
  drops_at timestamptz;
  submit_close timestamptz;
  voting_close timestamptz;
  new_drop_id uuid;
begin
  -- Already have a drop for this region+day? Nothing to do (idempotent cron).
  if exists (select 1 from public.prompt_drops where region = p_region and drop_date = today_local) then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'exists');
  end if;

  -- Prefer an unused prompt; else least-recently-used (rotation).
  select id, text into chosen
  from public.prompts
  order by used_at asc nulls first, random()
  limit 1;

  if chosen.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_prompts');
  end if;

  -- Randomized drop time inside the region evening window (19:00–20:00 local).
  drops_at     := ((today_local + time '19:00') at time zone 'Asia/Manila')
                  + make_interval(mins => floor(random() * 60)::int);
  submit_close := (((today_local + 1) + time '00:00') at time zone 'Asia/Manila');
  voting_close := (((today_local + 1) + time '08:00') at time zone 'Asia/Manila');

  insert into public.prompt_drops
    (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (chosen.id, p_region, today_local, drops_at, submit_close, voting_close, 'scheduled')
  on conflict (region, drop_date) do nothing
  returning id into new_drop_id;

  update public.prompts set used_at = today_local where id = chosen.id;

  -- TODO(Phase 4): queue jittered 10–15 min push fan-out (BeReal herd fix).
  return jsonb_build_object('ok', true, 'created', true, 'drop_id', new_drop_id, 'drops_at', drops_at);
end;
$$;

revoke execute on function public.drop_prompt(text) from public, anon, authenticated;
grant  execute on function public.drop_prompt(text) to service_role;


create or replace function public.close_due_drops()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  n int := 0;
begin
  for d in
    select id from public.prompt_drops
    where voting_closes_at <= now() and status <> 'revealed'
    order by voting_closes_at asc
  loop
    perform public.close_day(d.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'closed', n);
end;
$$;

revoke execute on function public.close_due_drops() from public, anon, authenticated;
grant  execute on function public.close_due_drops() to service_role;


-- ---------------------------------------------------------------------------
-- pg_cron schedules — best-effort so a missing extension never fails the push.
--   drop-prompt : daily 00:05 UTC (08:05 Manila) → create today's BETA drop
--   close-sweep : hourly → close any drop past its voting window
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'piqa-drop-prompt') then
    perform cron.unschedule('piqa-drop-prompt');
  end if;
  perform cron.schedule('piqa-drop-prompt', '5 0 * * *', $cron$ select public.drop_prompt('BETA'); $cron$);

  if exists (select 1 from cron.job where jobname = 'piqa-close-sweep') then
    perform cron.unschedule('piqa-close-sweep');
  end if;
  perform cron.schedule('piqa-close-sweep', '0 * * * *', $cron$ select public.close_due_drops(); $cron$);
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
