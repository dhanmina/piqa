-- supabase/migrations/0039_fix_peek_date_tolerance.sql
--
-- Real bug, not just a test-data artifact: is_reciprocal_peek_date (0034) checks
-- p_date against exact current_date - {7d,1mo,1yr} using the SERVER's UTC clock,
-- while get_buddy_peek matches using the CLIENT's local "today" (p_today param,
-- same reason get_today_state/get_peek_back take one -- current_date server-side
-- disagrees with a user's local date for a large part of every day depending on
-- timezone). Viewing a buddy's peek photo happened to still work because the
-- storage path in this session's test data was reused from the caller's own
-- folder (covered by the ordinary own-capture policy, bypassing reciprocity
-- entirely) -- but react_to_capture has no such bypass and hit the mismatch
-- directly: get_buddy_peek matches a capture using the client's local date,
-- then react_to_capture rejects that same capture because the server's UTC
-- current_date lands the offset on a different calendar day.
--
-- Fixed with a +-1 day tolerance band around each offset -- the maximum
-- possible UTC-vs-local skew for any real timezone is under 24 hours, so this
-- safely covers every real device without needing to thread a client-supplied
-- "today" through a storage policy function, which can't accept one anyway
-- (storage RLS invokes can_view_buddy_capture with just the object name).
create or replace function public.is_reciprocal_peek_date(p_date date)
returns boolean
language sql security definer stable
as $$
  select (
    p_date between current_date - 8 and current_date - 6
    or p_date between (current_date - interval '1 month' - interval '1 day')::date and (current_date - interval '1 month' + interval '1 day')::date
    or p_date between (current_date - interval '1 year' - interval '1 day')::date and (current_date - interval '1 year' + interval '1 day')::date
  )
  and exists (select 1 from public.captures where user_id = auth.uid() and captured_at = p_date);
$$;
