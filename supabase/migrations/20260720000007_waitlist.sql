create table if not exists public.waitlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Anyone can insert (landing page form uses anon key).
create policy "anon can join" on public.waitlist
  for insert to anon with check (true);

-- Admin RPC: list all waitlist entries (bypasses RLS via SECURITY DEFINER).
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
