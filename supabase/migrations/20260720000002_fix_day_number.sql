-- Fix: launch_date was set to min(drop_date) which picked up the seed's
-- "yesterday" drop, shifting all day_numbers by +1. Reset launch_date to the
-- first REAL drop (the earliest non-seed drop, or the earliest drop overall
-- if only one exists) and backfill every day_number.

-- 1. Find the true launch date: the drop_date of the earliest prompt_drop.
--    The seed past gallery created a yesterday drop that inflated the counter.
update public.config
set value = to_jsonb(
  (select min(drop_date)::text from public.prompt_drops)
)
where key = 'launch_date';

-- 2. Backfill every day_number from the corrected launch_date.
update public.prompt_drops pd
set day_number = (pd.drop_date - (value #>> '{}')::date) + 1
from public.config
where key = 'launch_date';
