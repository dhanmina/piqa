-- Open Frame: a fully open Subject ("anything, your eye") drawn from its own
-- pool on a fixed cadence (see drop_prompt() change in this same migration),
-- so accessibility isn't only ever a bet on how a literal Subject is worded.
--
-- Note on the category CHECK constraint name: the column-level check on
-- public.subjects.category was defined inline at CREATE TABLE time back when
-- the table was named public.prompts (20260711000001_init.sql), so Postgres
-- auto-named it prompts_category_check. The 20260721000002_rename_subjects.sql
-- migration renamed the table (public.prompts -> public.subjects) but table
-- renames do not rename constraints, so the live constraint name today is
-- still prompts_category_check, not subjects_category_check. Verified
-- empirically against a scratch Postgres instance. We drop both possible
-- names (IF EXISTS makes the miss a no-op) to be safe either way.

alter table public.subjects drop constraint if exists prompts_category_check;
alter table public.subjects drop constraint if exists subjects_category_check;
alter table public.subjects add constraint subjects_category_check
  check (category in ('object','color','light','pov','emotion','absurd','open'));

insert into public.subjects (text, category, seq)
select v.text, 'open', (select coalesce(max(seq), 0) from public.subjects) + v.ord
from (values
  ('Open Frame. Anything, your eye', 1),
  ('Open Frame. Whatever caught your eye today', 2),
  ('Open Frame. Shoot the thing you almost walked past', 3),
  ('Open Frame. No rules today, just your eye', 4),
  ('Open Frame. The photo you already wanted to take', 5),
  ('Open Frame. Show us how you see things', 6),
  ('Open Frame. One frame, total freedom', 7),
  ('Open Frame. Your day, one photo', 8),
  ('Open Frame. Whatever is in front of you right now', 9),
  ('Open Frame. Surprise the gallery', 10),
  ('Open Frame. Just shoot something you like', 11),
  ('Open Frame. A blank canvas kind of day', 12)
) as v(text, ord)
where not exists (select 1 from public.subjects s where s.text = v.text);

-- ---------------------------------------------------------------------------
-- drop_prompt() — add Open Frame cadence on top of the true-current body
-- verified in 20260721000002_rename_subjects.sql:772-813. Every Nth drop
-- (1-indexed: drop #5, #10, ... land on Open Frame), pull from the 'open'
-- pool first, same used_at cycling as the main pool. Falls through to the
-- normal pick (now explicitly excluding 'open') if the open pool is
-- temporarily exhausted, so an all-used-up open pool never blocks the
-- normal arc.
--
-- Implementation note: `chosen` is deliberately two scalar variables
-- (chosen_id/chosen_text), not a single `record`. A plpgsql `record`
-- variable that a SELECT INTO never touches is "not assigned" — reading
-- any field off it (e.g. `chosen.id is null`) raises
-- `record "chosen" is not assigned yet` at runtime, not just returns null.
-- On 4 of every 5 calls the open-pool branch below is skipped entirely, so
-- a record-typed `chosen` would blow up on every non-Open-Frame day.
-- Verified this failure mode reproduces against a local Postgres instance
-- with the plan's original `chosen record;` shape before switching to
-- scalars. Scalars default to NULL and have no such "unassigned" state.
-- ---------------------------------------------------------------------------
create or replace function public.drop_prompt(p_region text default 'PH')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  chosen_id uuid;
  chosen_text text;
  drops_at timestamptz;
  submit_close timestamptz;
  voting_close timestamptz;
  new_drop_id uuid;
  every_n int := public.cfg_int('open_frame_every_n_days', 5);
  drop_count int;
begin
  if exists (select 1 from public.subject_drops where region = p_region and drop_date = today_local) then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'exists');
  end if;

  select count(*) into drop_count from public.subject_drops where region = p_region;

  -- Every Nth drop (1-indexed: drop #5, #10, ... land on Open Frame),
  -- pull from the 'open' pool first, same used_at cycling as the main pool.
  -- Falls through to the normal pick if the open pool is exhausted.
  if every_n > 0 and (drop_count + 1) % every_n = 0 then
    select id, text into chosen_id, chosen_text
    from public.subjects
    where category = 'open'
    order by used_at asc nulls first, seq asc nulls last, random()
    limit 1;
  end if;

  if chosen_id is null then
    select id, text into chosen_id, chosen_text
    from public.subjects
    where category != 'open'
    order by used_at asc nulls first, seq asc nulls last, random()
    limit 1;
  end if;

  if chosen_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_prompts');
  end if;

  drops_at     := ((today_local + time '06:00') at time zone 'Asia/Manila')
                  + make_interval(mins => floor(random() * 60)::int);
  submit_close := ((today_local + time '18:00') at time zone 'Asia/Manila');
  voting_close := ((today_local + time '19:00') at time zone 'Asia/Manila');

  insert into public.subject_drops
    (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (chosen_id, p_region, today_local, drops_at, submit_close, voting_close, 'scheduled')
  on conflict (region, drop_date) do nothing
  returning id into new_drop_id;

  update public.subjects set used_at = today_local where id = chosen_id;

  return jsonb_build_object('ok', true, 'created', true, 'drop_id', new_drop_id, 'drops_at', drops_at);
end;
$$;

-- Default config row so cfg_int has a documented value (mirrors the existing
-- seed rows in 20260711000001_init.sql:160+, e.g. ('vote_cap', '50')).
insert into public.config (key, value)
values ('open_frame_every_n_days', '5')
on conflict (key) do nothing;
