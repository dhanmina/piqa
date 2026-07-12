-- Curation showed blank photos. get_matchup serves OTHER users' submissions in
-- the live voting window, but the only storage read policies on the submissions
-- bucket were "your own objects" and "in_gallery objects". A matchup photo is
-- someone else's, not-yet-in-gallery shot — so createSignedUrl was denied by RLS
-- and the client got a null uri (fetched fine, just unsignable → blank).
--
-- Allow authenticated users to read the THUMBNAIL of any submission whose drop
-- is still in its voting window — exactly what blind curation needs. Scoped to
-- thumb_path only, so full-res of others' live shots stays private until the
-- gallery makes it public at close.
create policy "live drop thumbs are readable for curation"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and exists (
      select 1
      from public.submissions s
      join public.prompt_drops pd on pd.id = s.drop_id
      where s.thumb_path = name
        and now() >= pd.drops_at
        and now() < pd.voting_closes_at
    )
  );
