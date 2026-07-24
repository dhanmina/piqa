-- One-off (2026-07-24): last-call nudge to users who have NOT yet submitted to
-- the currently-open drop. Runs once at push time. Guarded to drops that are
-- still accepting submissions (now between drops_at and submit_closes_at) so the
-- "the day's still open" copy is always true. Rides send_push(..., 'daily'), so
-- notif_daily prefs + quiet hours are honored per recipient. Best-effort.
do $$
declare
  d   record;
  ids uuid[];
begin
  for d in
    select id, region
    from public.subject_drops
    where now() >= drops_at and now() < submit_closes_at
  loop
    ids := array(
      select p.id
      from public.profiles p
      where p.region = d.region
        and p.push_token is not null
        and not exists (
          select 1 from public.submissions s
          where s.drop_id = d.id and s.user_id = p.id
        )
    );
    if ids is not null and array_length(ids, 1) > 0 then
      perform public.send_push(
        'Don''t miss today''s Subject 📷',
        'The day''s still open. Capture your shot before it closes.',
        jsonb_build_object('type', 'drop'),
        null, ids, 'daily'
      );
      raise notice 'lastcall drop %: % recipients queued', d.id, array_length(ids, 1);
    end if;
  end loop;
end;
$$;
