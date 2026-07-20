-- Admin RPC: remove an email from the waitlist.
create or replace function public.admin_delete_waitlist(p_email text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  delete from public.waitlist where email = p_email;
  select jsonb_build_object('ok', true);
$$;

revoke execute on function public.admin_delete_waitlist(text) from public, anon, authenticated;
grant  execute on function public.admin_delete_waitlist(text) to authenticated;
