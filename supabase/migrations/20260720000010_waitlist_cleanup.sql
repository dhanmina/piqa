-- Cleanup: remove test email and grant full DML to anon.
delete from public.waitlist where email = 'test-verify@example.com';
grant all on public.waitlist to anon;
