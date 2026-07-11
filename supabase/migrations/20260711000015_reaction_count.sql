-- Keep submissions.reaction_count in sync with the reactions table so a signed
-- heart (spec §8) reflects live on the photo. Data stays split: vote_count feeds
-- ranking (frozen at close), reaction_count is post-gallery appreciation that
-- never re-ranks. SECURITY DEFINER so the trigger may touch another user's
-- submission row (RLS otherwise blocks cross-user updates).

create or replace function public.bump_reaction_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.submissions
      set reaction_count = reaction_count + 1
      where id = new.submission_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.submissions
      set reaction_count = greatest(reaction_count - 1, 0)
      where id = old.submission_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger reactions_count_sync
  after insert or delete on public.reactions
  for each row execute function public.bump_reaction_count();
