-- Settings redesign added real self-service account deletion (previously only
-- sign-out existed). Collects the caller's own capture storage paths before
-- deleting auth.users -- the FK chain (profiles -> captures/streaks/frozen_dates/
-- streak_buddies/reactions, all "on delete cascade" from 0001/0002/0013) removes
-- every DB row for free, but Storage isn't a plain table under that FK graph, so
-- the caller still has to remove the actual bucket objects itself (same reason
-- delete_capture, 0021, returns a path instead of deleting storage server-side).
--
-- `return query` inside a setof-returning plpgsql function accumulates rows
-- rather than exiting immediately, so the select below still runs (and its
-- rows are still queued for return) before the delete that follows it.
create function public.delete_own_account()
returns setof text
language plpgsql security definer
as $$
begin
  return query select storage_path from public.captures where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;
