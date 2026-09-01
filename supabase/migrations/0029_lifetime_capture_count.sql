-- Every existing stat (current/longest streak, freezes) is streak-derived --
-- nothing anywhere reports the simple lifetime total. Deliberately its own
-- function rather than folding into get_today_state: that RPC already carries
-- real streak/freeze-rollover logic, and this is a plain count with none of it.
create function public.get_lifetime_capture_count()
returns int
language sql security definer stable
as $$
  select count(*)::int from public.captures where user_id = auth.uid();
$$;
