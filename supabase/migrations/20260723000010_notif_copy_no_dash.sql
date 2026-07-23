-- Copy fix: remove em-dashes from the push copy (founder preference — dashes read
-- as AI-generated). Only notify_pending had them (the daily + results bodies).
-- Rephrase with plain punctuation; logic and the rest of the copy unchanged.

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
  for d in
    select pd.id, pd.region, sub.text as subject
    from public.subject_drops pd
    join public.subjects sub on sub.id = pd.prompt_id
    where pd.drops_at <= now() and pd.live_notified_at is null and pd.status in ('scheduled', 'live')
  loop
    begin
      perform public.send_push(
        'Today''s Subject 📷',
        coalesce(d.subject, 'A new Subject') || '. Show us your eye.',
        jsonb_build_object('type', 'drop'),
        d.region, null, 'daily'
      );
      update public.subject_drops set live_notified_at = now() where id = d.id;
      n := n + 1;
    exception when others then raise notice 'notify live % failed: %', d.id, sqlerrm; end;
  end loop;

  for d in
    select id, region from public.subject_drops
    where status = 'revealed' and reveal_notified_at is null
  loop
    begin
      perform public.send_push(
        'Today''s gallery is live ✨',
        'See the shots that made it, and today''s Photo of the Day.',
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
