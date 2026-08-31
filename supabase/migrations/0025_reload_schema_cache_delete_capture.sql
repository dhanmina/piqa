-- PGRST202 on public.delete_capture recurred after 0023's reload despite the
-- function being present and unchanged since 0021 -- PostgREST's cache went
-- stale again independent of any further DDL on this function. Forcing
-- another reload; if this recurs, PostgREST's auto-reload event trigger
-- itself likely needs investigating rather than papering over it here again.
notify pgrst, 'reload schema';
