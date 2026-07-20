-- Fix: replace RLS-based waitlist read with an admin RPC (matches the
-- pattern used by every other admin query — SECURITY DEFINER bypasses RLS).

create or replace function public.admin_list_waitlist()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('email', w.email, 'created_at', w.created_at)
    order by w.created_at desc
  ), '[]'::jsonb)
  from public.waitlist w;
$$;

revoke execute on function public.admin_list_waitlist() from public, anon, authenticated;
grant  execute on function public.admin_list_waitlist() to authenticated;
