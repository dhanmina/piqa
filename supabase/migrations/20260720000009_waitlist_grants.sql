-- Fix: grant table-level permissions to anon for the waitlist table.
-- RLS policies alone are not enough — the role also needs GRANTs.

grant select, insert on public.waitlist to anon;
