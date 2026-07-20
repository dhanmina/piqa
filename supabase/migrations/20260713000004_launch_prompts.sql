-- Launch prompt library — the ordered 30-day arc (days 1-30).
--
-- The arc's whole value is the ORDER (confidence → danger → taste → payoff, no
-- two hard days running, escalating weekly Goldens, day 1/30 rhyme). But
-- drop_prompt() picked "used_at asc nulls first, random()" — random among the
-- unused pool, which would scramble the arc. So:
--   1. add an explicit `seq` order column,
--   2. clear the old UNASSIGNED prompts (referenced ones can't go — FK/history),
--   3. insert the 30 in order,
--   4. make assignment sequential (seq asc) instead of random.
--
-- The Golden (🏆) flag on days 7/14/21/28 is deferred until that feature lands
-- (spec: config/event table), so it's not stored here yet. Category values map
-- to the CHECK constraint (POV → pov).

alter table public.prompts add column if not exists seq int;

-- Only prompts not already tied to a drop can go (FK is RESTRICT; past/current
-- drops keep their prompt so history is intact). The new arc starts next drop.
delete from public.prompts
where id not in (select prompt_id from public.prompt_drops);

insert into public.prompts (text, category, seq) values
  ('Something red you can reach right now', 'object', 1),
  ('Your view, exactly how you see it', 'pov', 2),
  ('Where the light lands in your room', 'light', 3),
  ('Three things that share a color', 'color', 4),
  ('The most useless thing you own', 'absurd', 5),
  ('The spot in your home where people gather', 'emotion', 6),
  ('Just shadows. The shadow is the shot', 'light', 7),
  ('Give something a face', 'absurd', 8),
  ('Blue, but not the sky', 'color', 9),
  ('From the floor, looking up', 'pov', 10),
  ('What a villain eats for breakfast', 'absurd', 11),
  ('The oldest thing you can find', 'object', 12),
  ('Light coming from behind it', 'light', 13),
  ('Shoot through something. A gap, a hole, some glass', 'pov', 14),
  ('Green that isn''t a plant', 'color', 15),
  ('The smallest thing you own, shot like it''s huge', 'absurd', 16),
  ('A reflection', 'light', 17),
  ('Quiet', 'emotion', 18),
  ('Straight down onto your table', 'pov', 19),
  ('Something worn out from being loved', 'object', 20),
  ('Let one color take over the frame', 'color', 21),
  ('Warm light. A lamp, or golden hour', 'light', 22),
  ('Whatever is right behind you', 'pov', 23),
  ('Something that comes in twos', 'object', 24),
  ('A scene with barely any color', 'color', 25),
  ('Make something ordinary look expensive', 'absurd', 26),
  ('Two cups, one table', 'emotion', 27),
  ('Chase the best light in your home and catch it', 'light', 28),
  ('Lines. Find them wherever you are', 'object', 29),
  ('Your whole day in one object', 'emotion', 30);

-- Assign in arc order: unused first (used_at null), then by seq, then random for
-- anything without a seq. Only line changed from the original is the ORDER BY.
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
  if exists (select 1 from public.prompt_drops where region = p_region and drop_date = today_local) then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'exists');
  end if;

  select id, text into chosen
  from public.prompts
  order by used_at asc nulls first, seq asc nulls last, random()
  limit 1;

  if chosen.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_prompts');
  end if;

  drops_at     := ((today_local + time '06:00') at time zone 'Asia/Manila')
                  + make_interval(mins => floor(random() * 60)::int);
  submit_close := ((today_local + time '18:00') at time zone 'Asia/Manila');
  voting_close := ((today_local + time '19:00') at time zone 'Asia/Manila');

  insert into public.prompt_drops
    (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (chosen.id, p_region, today_local, drops_at, submit_close, voting_close, 'scheduled')
  on conflict (region, drop_date) do nothing
  returning id into new_drop_id;

  update public.prompts set used_at = today_local where id = chosen.id;

  return jsonb_build_object('ok', true, 'created', true, 'drop_id', new_drop_id, 'drops_at', drops_at);
end;
$$;

revoke execute on function public.drop_prompt(text) from public, anon, authenticated;
grant  execute on function public.drop_prompt(text) to service_role;
