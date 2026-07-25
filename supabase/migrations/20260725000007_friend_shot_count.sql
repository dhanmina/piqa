-- Friend social proof: count how many followed users submitted to today's active drop.
-- Returns 0 when there are no followed photographers who shot today.
create or replace function public.get_friend_shot_count_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from submissions s
  join subject_drops sd on sd.id = s.drop_id
  join follows f on f.followee_id = s.user_id
  where sd.status = 'live'
    and s.quarantined = false
    and f.follower_id = auth.uid()
$$;

grant execute on function public.get_friend_shot_count_today() to authenticated;
