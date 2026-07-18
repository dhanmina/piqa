-- Photo frames become CONTEXTUAL — a photo wears the frame of the day/event it was
-- captured, not the owner's currently-equipped frame. This ends the anachronism where
-- equipping (say) the Valentine's frame re-skinned a July photo. `equipped_frame` on
-- profiles now means the PROFILE frame (the avatar ring); it no longer touches photos.
--
-- The frame is DERIVED from the immutable drop_date (no per-photo storage), so it's
-- retroactively correct: on an event day → that event's frame; otherwise → default.
-- Winning a PotD is still a per-photo STATUS (crown glyph on the rail), never a frame.

-- photo_frame(date) — the event frame whose window contains the date, else 'default'.
create or replace function public.photo_frame(p_date date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select f.id
    from public.frames f
    where f.unlock_kind = 'event'
      and f.event_start is not null and f.event_end is not null
      and p_date between f.event_start and f.event_end
    order by f.event_start desc
    limit 1
  ), 'default');
$$;

revoke execute on function public.photo_frame(date) from public, anon;
grant  execute on function public.photo_frame(date) to authenticated, service_role;

-- decorate_photos — stamp each photo with its CONTEXTUAL frame (was: the owner's live
-- equipped_frame). Key renamed equipped_frame -> frame_id so the meaning is honest; the
-- profiles join is gone (frame no longer depends on the owner). status/day_number are
-- unchanged and still read live. Covers gallery, following, latest, and profile-wins
-- (every caller of decorate_photos).
create or replace function public.decorate_photos(p_photos jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
           t.ph || jsonb_build_object(
             'frame_id',   public.photo_frame(pd.drop_date),
             'day_number', pd.day_number,
             'status',     public.photo_status(s.is_potd, s.gallery_rank)
           )
           order by t.ord
         ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) with ordinality as t(ph, ord)
  left join public.submissions   s  on s.id  = (t.ph ->> 'id')::uuid
  left join public.prompt_drops  pd on pd.id = s.drop_id;
$$;

revoke execute on function public.decorate_photos(jsonb) from public, anon;
grant  execute on function public.decorate_photos(jsonb) to authenticated, service_role;
