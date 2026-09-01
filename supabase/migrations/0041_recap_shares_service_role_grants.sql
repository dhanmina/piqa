-- supabase/migrations/0041_recap_shares_service_role_grants.sql
--
-- This project's Data API does not auto-expose new tables to any role (see
-- config.toml's [api] auto_expose_new_tables comment -- the new cloud default),
-- so creating recap_shares in 0040 without an explicit grant left service_role
-- with RLS bypass (rolbypassrls) but no base SELECT privilege on either table --
-- PostgREST returned a permission-denied error indistinguishable, from
-- get-shared-recap's perspective, from "share not found". The get-shared-recap
-- Edge Function is specifically designed to read both tables as service_role on
-- behalf of an unauthenticated caller (see 0040's header comment), so it needs
-- SELECT here. This does not loosen anything for anon/authenticated -- RLS on
-- both tables is untouched, and service_role already bypasses RLS by role
-- attribute, not by grant.
grant select on public.recap_shares to service_role;
grant select on public.captures to service_role;
