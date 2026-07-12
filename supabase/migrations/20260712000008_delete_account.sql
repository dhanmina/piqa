-- Phase 4 · Step 8b — Account deletion (Play-required, spec §12).
--
-- SECURITY DEFINER SQL RPC (the whole backend is RPCs, not Edge Functions).
-- Purges the caller's storage objects, then deletes their auth.users row, which
-- cascades every owned row: profile → streaks, submissions, votes, reactions,
-- follows, reports, free_shots, blocks (all FK on delete cascade). Materialized
-- gallery blobs are immutable snapshots and are left as-is (a past win stays in
-- the historical record; the live submission row is gone). No re-rank happens.

create or replace function public.delete_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  -- Purge storage objects this user uploaded (submissions + avatars buckets).
  delete from storage.objects where owner = uid;

  -- Delete the auth user → cascades all owned public rows.
  delete from auth.users where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant  execute on function public.delete_account() to authenticated;
