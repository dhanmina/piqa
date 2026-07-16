-- email_exists — does an account use this email? Powers the forgot-password
-- screen's "No account found for that email." feedback.
--
-- TRADEOFF (deliberate, product decision): this is a public endpoint (anon can
-- call it, because the reset flow runs logged out), so it lets anyone test which
-- emails have a piqa account — an enumeration/harvesting vector that reset flows
-- normally avoid. Accepted for beta for the clearer UX; revisit at scale (rate
-- limit, captcha, or drop back to the enumeration-safe wording).
create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(p_email))
  );
$$;

revoke execute on function public.email_exists(text) from public;
grant  execute on function public.email_exists(text) to anon, authenticated;
