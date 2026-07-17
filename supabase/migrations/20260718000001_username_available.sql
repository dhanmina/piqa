-- username_available — is this username free to claim? Powers the live "available /
-- taken" status under the sign-up form's username field (and the Edit-profile rename).
--
-- Returns true only when the name is BOTH the right length (3-24, matching the
-- profiles check constraint) and unused. Comparison is case-insensitive: usernames
-- are stored lowercased at sign-up, but we lower() both sides so a stray capital in
-- the field never reads as "available" for a name that's actually taken.
--
-- Like email_exists, this is callable by anon (the sign-up form runs logged out).
-- Same enumeration tradeoff applies — it lets anyone probe which usernames exist —
-- accepted for beta for the clearer UX; revisit at scale.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    char_length(trim(p_username)) between 3 and 24
    and not exists (
      select 1 from public.profiles
      where lower(username) = lower(trim(p_username))
    );
$$;

revoke execute on function public.username_available(text) from public;
grant  execute on function public.username_available(text) to anon, authenticated;
