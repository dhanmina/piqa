-- Frames as content — the look of a frame becomes data, so new frames can be added
-- from a dashboard (Supabase Studio for now) with NO app release.
--
-- The rail stays locked in code: border, PIQA mark, day counter, dot, and status
-- glyph never move — that is what keeps every frame legible at a thumbnail and
-- guarantees the counter can't collide with anything. A frame record supplies only
-- what varies between frames: the hairline, the marker glyph (an SVG), an optional
-- suffix, and the counter color. See src/components/molecules/FramedPhoto.tsx.
--
-- The previous migration (20260715000001) created frames(id, label) with two seeded
-- rows and hardcoded 'crown' in a couple of places. This one turns those into data
-- and generalizes the hardcoded spots so a third frame Just Works.

-- ---------------------------------------------------------------------------
-- 1. Render + unlock columns
-- ---------------------------------------------------------------------------
alter table public.frames
  add column if not exists marker_svg       text,               -- self-contained <svg> glyph; null → the app's default triangle
  add column if not exists hairline_color   text not null default '#F2EDE4',
  add column if not exists hairline_opacity real not null default 0.35,
  add column if not exists counter_color    text not null default '#F2EDE4',
  add column if not exists suffix_text      text,               -- e.g. '· CROWN'; null → no suffix
  add column if not exists suffix_color     text,
  add column if not exists unlock_kind      text not null default 'manual'
    check (unlock_kind in ('default','potd','event','manual')),
  add column if not exists unlock_label     text,               -- shown while locked
  add column if not exists event_start      date,
  add column if not exists event_end        date;

-- ---------------------------------------------------------------------------
-- 2. Migrate the two existing frames into data (identical look to before)
-- ---------------------------------------------------------------------------
update public.frames set
  hairline_color = '#F2EDE4', hairline_opacity = 0.35,
  marker_svg = null,                                    -- default triangle drawn natively
  unlock_kind = 'default'
where id = 'default';

update public.frames set
  hairline_color = '#E3B341', hairline_opacity = 0.5,
  counter_color = '#F2EDE4',
  -- The crown glyph from assets/frames/frame-crown.svg, re-authored around origin
  -- in its own viewBox so the app can drop it into the fixed marker slot.
  marker_svg = '<svg viewBox="-14 -12 28 28" xmlns="http://www.w3.org/2000/svg"><path d="M-12 6 L-12 -4 L-6 1 L0 -8 L6 1 L12 -4 L12 6 Z" fill="#E3B341"/><rect x="-12" y="8" width="24" height="3" fill="#E3B341"/></svg>',
  suffix_text = '· CROWN', suffix_color = '#E3B341',
  unlock_kind = 'potd', unlock_label = 'Win a Photo of the Day'
where id = 'crown';

-- ---------------------------------------------------------------------------
-- 3. Valentine's — a worked example of an EVENT frame added purely as data.
--    It shows up immediately as a locked frame; it becomes claimable Feb 1-14.
--    This is exactly the shape a dashboard row would take.
-- ---------------------------------------------------------------------------
-- The window is Feb 1-14 of this year, or next year if we're already past it.
with y as (
  select extract(year from current_date)::int
         + (case when current_date > make_date(extract(year from current_date)::int, 2, 14)
                 then 1 else 0 end) as yr
)
insert into public.frames
  (id, label, hairline_color, hairline_opacity, counter_color, marker_svg,
   suffix_text, suffix_color, unlock_kind, unlock_label, event_start, event_end)
select
  'valentines', 'Valentine''s', '#E6453C', 0.5, '#F2EDE4',
  '<svg viewBox="-13 -13 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M0 8 C -10 -2 -8 -12 -3 -9 C -1 -8 0 -6 0 -5 C 0 -6 1 -8 3 -9 C 8 -12 10 -2 0 8 Z" fill="#E6453C"/></svg>',
  '· VALENTINE''S', '#E6453C',
  'event', 'Valentine''s · back Feb 1',
  make_date(y.yr, 2, 1), make_date(y.yr, 2, 14)
from y
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Ownership generalizes: own a frame if it is unlock_kind='default' OR you
--    have a user_frames row. (Was: the literal id 'default' or a user_frames row.)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_equipped_frame()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.equipped_frame is distinct from old.equipped_frame
     and not exists (
       select 1 from public.frames f
       where f.id = new.equipped_frame and f.unlock_kind = 'default'
     )
     and not exists (
       select 1 from public.user_frames uf
       where uf.user_id = new.id and uf.frame_id = new.equipped_frame
     )
  then
    raise exception 'frame_not_unlocked';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Winning a Photo of the Day grants every unlock_kind='potd' frame.
--    A trigger on the is_potd transition instead of hardcoding 'crown' inside
--    close_day: this stays data-driven (a future potd frame auto-grants) AND
--    avoids re-emitting the 250-line close_day. It supersedes the inline crown
--    insert in 20260715000001 (which is now a harmless idempotent duplicate).
-- ---------------------------------------------------------------------------
create or replace function public.grant_potd_frames()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_potd and not coalesce(old.is_potd, false) then
    insert into public.user_frames (user_id, frame_id)
    select new.user_id, f.id from public.frames f where f.unlock_kind = 'potd'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_grant_potd_frames on public.submissions;
create trigger submissions_grant_potd_frames
  after update of is_potd on public.submissions
  for each row execute function public.grant_potd_frames();

-- Backfill: past winners get every current potd frame.
insert into public.user_frames (user_id, frame_id)
select s.user_id, f.id
from public.submissions s
cross join public.frames f
where s.is_potd and f.unlock_kind = 'potd'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6. claim_event_frame — the ONLY client-reachable writer of user_frames, and it
--    can only grant an event frame during its window. Crown stays unforgeable
--    (it is 'potd', not 'event', so this can never grant it).
-- ---------------------------------------------------------------------------
create or replace function public.claim_event_frame(p_frame text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  f public.frames%rowtype;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into f from public.frames where id = p_frame;
  if f.id is null or f.unlock_kind <> 'event' then
    return jsonb_build_object('ok', false, 'reason', 'not_an_event_frame');
  end if;
  if f.event_start is null or f.event_end is null
     or current_date < f.event_start or current_date > f.event_end then
    return jsonb_build_object('ok', false, 'reason', 'outside_window');
  end if;

  insert into public.user_frames (user_id, frame_id)
  values (uid, p_frame)
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.claim_event_frame(text) from public, anon;
grant  execute on function public.claim_event_frame(text) to authenticated;
