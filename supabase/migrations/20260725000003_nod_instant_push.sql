-- Instant nod push: when a curator gives a nod, the photographer gets an
-- immediate "A curator noticed your {tag}" push. Research-backed: instant
-- per-nod (Instagram/Strava pattern), not batched — the OS stacks rapid
-- notifications naturally, and the first nod IS the magic moment.
--
-- The daily appreciation digest (notify_appreciation) still fires as a warm
-- recap of the full day's hearts + nods.

create or replace function public.trg_nod_appreciation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner    uuid;
  v_drop     uuid;
  v_tag      text;
  v_label    text;
  v_sub_path text;
begin
  -- 1) Activity feed row (unchanged).
  perform public.record_appreciation(new.submission_id, new.curator_id);

  -- 2) Instant nod push to the photographer.
  select s.user_id, s.drop_id, s.image_path
    into v_owner, v_drop, v_sub_path
  from public.submissions s
  where s.id = new.submission_id;

  if v_owner is null or v_owner = new.curator_id then
    return new; -- no shot, or your own
  end if;

  -- Map tag to human copy.
  v_tag := new.tag;
  v_label := case v_tag
    when 'great_light'        then 'beautiful light'
    when 'strong_composition' then 'nice framing'
    when 'bold_color'         then 'your colors'
    when 'perfect_timing'     then 'perfect timing'
    when 'fresh_perspective'  then 'your angle'
    when 'so_creative'        then 'your creativity'
    when 'tells_a_story'      then 'your story'
    when 'moved_me'           then 'your photo'
    else 'your photo'
  end;

  perform public.send_push(
    'A curator noticed ' || v_label || ' ✨',
    'Someone saw what you did there. Open to see who.',
    jsonb_build_object(
      'type',    'nod',
      'photoId', new.submission_id,
      'dropId',  v_drop
    ),
    null,
    array[v_owner],
    'appreciation'
  );

  return new;
exception when others then return new; -- never block a nod
end;
$$;
