-- resolve_username — look up a user UUID by username for share-link deep links.
-- Returns null if the username doesn't exist.
create or replace function public.resolve_username(p_username text)
returns uuid
language sql
stable
security definer
as $$
  select id from public.profiles where username = lower(trim(p_username)) limit 1;
$$;

revoke execute on function public.resolve_username(text) from public, anon;
grant  execute on function public.resolve_username(text) to authenticated;
