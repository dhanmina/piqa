-- Social proof: count how many photographers submitted to today's active drop.
-- Returns 0 when there is no live drop. This is a lightweight read used on the
-- Today screen to create community anticipation ("42 photographers are shooting").

create or replace function public.get_shot_count_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from submissions s
  join subject_drops sd on sd.id = s.drop_id
  where sd.status = 'live'
    and s.quarantined = false
$$;

grant execute on function public.get_shot_count_today() to authenticated;
