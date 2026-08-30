-- PostgREST caches the Postgres schema and normally auto-refreshes on DDL via an
-- event trigger, but after 0021's delete_capture() landed, PostgREST's cache still
-- didn't see it (PGRST202: "Could not find the function public.delete_capture...
-- in the schema cache"). Forcing a reload directly.
notify pgrst, 'reload schema';
