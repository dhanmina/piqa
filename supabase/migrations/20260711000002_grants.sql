-- Data API grants — new Supabase projects no longer auto-expose tables to the
-- API roles; each table needs explicit grants. RLS (already enabled on every
-- table) still governs which ROWS are visible; these govern which VERBS exist.
-- anon gets nothing: every surface in Piqa requires an authenticated session.

grant usage on schema public to authenticated, service_role;

grant select, insert, update         on public.profiles     to authenticated;
grant select                         on public.prompts      to authenticated;
grant select                         on public.prompt_drops to authenticated;
grant select, insert, update, delete on public.submissions  to authenticated;
grant select, insert                 on public.votes        to authenticated;
grant select, insert, update         on public.streaks      to authenticated;
grant select, insert, delete         on public.reactions    to authenticated;
grant select, insert, delete         on public.follows      to authenticated;
grant insert                         on public.reports      to authenticated;
grant select, insert, update, delete on public.free_shots   to authenticated;
grant select                         on public.config       to authenticated;

-- Edge Functions / close-day / drop-prompt run as service_role (bypasses RLS,
-- but still needs table privileges).
grant all on all tables in schema public to service_role;
