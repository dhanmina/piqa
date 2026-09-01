-- The Profile tab (and its stats/history trace) was cut entirely -- nothing
-- calls either of these any more.
drop function if exists public.get_lifetime_capture_count();
drop function if exists public.get_account_trace();
