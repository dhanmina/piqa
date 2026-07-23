-- Notification copy pass: natural, warm, curiosity-driven (see notification-plan
-- "Copy & tone"). Pulls users in through genuine value, never FOMO/guilt.
-- Biggest win: the daily push now names the actual SUBJECT — the creative spark
-- is the hook, not a generic "a new Subject is live". Logic unchanged; only the
-- strings (and a subjects join for the daily push).

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
  -- Drop is live — lead with the Subject itself; that prompt is the pull.
  for d in
    select pd.id, pd.region, sub.text as subject
    from public.subject_drops pd
    join public.subjects sub on sub.id = pd.prompt_id
    where pd.drops_at <= now() and pd.live_notified_at is null and pd.status in ('scheduled', 'live')
  loop
    begin
      perform public.send_push(
        'Today''s Subject 📷',
        coalesce(d.subject, 'A new Subject') || ' — show us your eye.',
        jsonb_build_object('type', 'drop'),
        d.region, null, 'daily'
      );
      update public.subject_drops set live_notified_at = now() where id = d.id;
      n := n + 1;
    exception when others then raise notice 'notify live % failed: %', d.id, sqlerrm; end;
  end loop;

  -- Gallery revealed.
  for d in
    select id, region from public.subject_drops
    where status = 'revealed' and reveal_notified_at is null
  loop
    begin
      perform public.send_push(
        'Today''s gallery is live ✨',
        'See the shots that made it — and today''s Photo of the Day.',
        jsonb_build_object('type', 'reveal'),
        d.region, null, 'results'
      );
      perform public.send_push(
        'You won Photo of the Day 👑',
        'Out of everyone today, your shot took the crown.',
        jsonb_build_object('type', 'potd'),
        null,
        array(select user_id from public.submissions where drop_id = d.id and is_potd),
        'wins'
      );
      perform public.send_push(
        'Your shot made the gallery ✨',
        'The curators picked you into today''s gallery. Nicely done.',
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
    coalesce(uname, 'Someone') || ' followed you',
    'You''ve got a new follower on Piqa.',
    jsonb_build_object('type', 'follow', 'userId', new.follower_id),
    null, array[new.followee_id], 'social'
  );
  return new;
exception when others then return new; end;
$$;

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
        'Your shot got some love ❤️',
        r.cnt || case when r.cnt = 1 then ' curator appreciated it today.'
                      else ' curators appreciated it today.' end,
        jsonb_build_object('type', 'appreciation'),
        null, array[r.uid], 'appreciation'
      );
      n := n + 1;
    exception when others then raise notice 'appreciation % failed: %', r.uid, sqlerrm; end;
  end loop;
  return jsonb_build_object('ok', true, 'sent', n);
end;
$$;
