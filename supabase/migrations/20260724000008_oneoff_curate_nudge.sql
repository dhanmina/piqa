-- One-off (2026-07-24): nudge users to curate the currently-open drop. Runs once
-- at push time. Guarded to drops in the curation window (now between
-- submit_closes_at and voting_closes_at) so "submissions are in" and "before
-- voting closes" are always true. Targets users who have NOT cast a vote for the
-- drop yet. Rides send_push(..., 'daily'), so notif_daily prefs + quiet hours are
-- honored per recipient. Best-effort.
do $$
declare
  d   record;
  ids uuid[];
begin
  for d in
    select id, region
    from public.subject_drops
    where now() >= submit_closes_at and now() < voting_closes_at
  loop
    ids := array(
      select p.id
      from public.profiles p
      where p.region = d.region
        and p.push_token is not null
        and not exists (
          select 1 from public.votes v
          where v.drop_id = d.id and v.voter_id = p.id
        )
    );
    if ids is not null and array_length(ids, 1) > 0 then
      perform public.send_push(
        'Help pick today''s gallery 🖼️',
        'Submissions are in. Curate the matchups to decide the gallery and today''s Photo of the Day.',
        jsonb_build_object('type', 'curate'),
        null, ids, 'daily'
      );
      raise notice 'curate nudge drop %: % recipients queued', d.id, array_length(ids, 1);
    end if;
  end loop;
end;
$$;
