-- Following gallery: a recent chronological window, not an all-time wall.
--
-- The feed was every gallery placement from everyone you follow, across all
-- drops ever, newest-first, capped at 60. Because submissions are unique per
-- (drop_id, user_id), a person can place at most once per drop — so the only
-- way one shooter fills the wall is by placing on many *different* days, which
-- the all-time query surfaced as if those old days were fresh.
--
-- Bound the feed to the trailing 7 drop-days. This matches the app's daily
-- rhythm (like the World tab, which is a single day's gallery) and the
-- BeReal/Glass model of a chronological following feed, while the 7-day span
-- (rather than latest-drop-only) keeps the feed non-empty for a young, sparse
-- follow graph. No per-author cap is needed: one-per-drop already guarantees
-- at most one tile per person per day.
create or replace function public.get_following_gallery()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  photos jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select coalesce(jsonb_agg(row order by dd desc, potd desc, hearts desc), '[]'::jsonb)
    into photos
  from (
    select jsonb_build_object(
             'id', s.id,
             'thumb_path', s.thumb_path,
             'image_path', s.image_path,
             'user_id', s.user_id,
             'shooter', pr.username,
             'hearts', s.vote_count + s.reaction_count,
             'is_potd', s.is_potd,
             'captured_at', s.captured_at,
             'drop_date', pd.drop_date
           ) as row,
           pd.drop_date as dd, s.is_potd as potd, (s.vote_count + s.reaction_count) as hearts
    from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    join public.profiles pr on pr.id = s.user_id
    where s.in_gallery
      and pd.drop_date >= current_date - 7
      and s.user_id in (select followee_id from public.follows where follower_id = me)
    order by pd.drop_date desc, s.is_potd desc, (s.vote_count + s.reaction_count) desc
    limit 60
  ) q;

  return jsonb_build_object(
    'photos', public.decorate_photos(public.filter_public_photos(photos, me))
  );
end;
$$;

revoke execute on function public.get_following_gallery() from public, anon;
grant  execute on function public.get_following_gallery() to authenticated;
