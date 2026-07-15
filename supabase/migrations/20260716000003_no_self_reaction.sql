-- No self-hearts: you can't react to your own photo.
--
-- The insert policy only checked that the reaction row is yours (user_id =
-- auth.uid()), not that the photo belongs to someone else, so a user could heart
-- their own submission. Tighten it to reject a reaction on an own submission.
-- This is the real enforcement; the UI additionally hides the like on own photos.
drop policy if exists "users insert own reaction" on public.reactions;
create policy "users insert own reaction"
  on public.reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.user_id = auth.uid()
    )
  );
