-- Earn an event's PROFILE frame by participating — shooting the daily on an event day
-- unlocks that event's frame automatically, replacing the manual claim_event_frame flow.
-- The photo itself already wears the event frame (contextual, via photo_frame); this
-- grants the equippable profile version.
--
-- SECURITY DEFINER so it can write user_frames, which has no client insert grant
-- (invariant: the only writers are this trigger and close_day's PotD unlock).
create or replace function public.grant_event_frame_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fr text;
begin
  select public.photo_frame(pd.drop_date) into fr
  from public.prompt_drops pd
  where pd.id = new.drop_id;

  -- Only real event frames unlock (default is everyone's base, never "earned").
  if fr is not null and fr <> 'default' then
    insert into public.user_frames (user_id, frame_id)
    values (new.user_id, fr)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_grant_event_frame on public.submissions;
create trigger submissions_grant_event_frame
  after insert on public.submissions
  for each row execute function public.grant_event_frame_on_submission();
