-- Gallery photos are public (spec §13) — but the storage read policy only
-- allowed reading your OWN objects, so clients couldn't sign other users'
-- gallery thumbs (every gallery tile came back blank). Add a read policy for
-- objects behind an in_gallery submission.

create policy "gallery submission objects are readable"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and exists (
      select 1 from public.submissions s
      where s.in_gallery and (s.image_path = name or s.thumb_path = name)
    )
  );

-- Make the seed submissions this drop's gallery so the demo shows real photos
-- before close-day exists. Deterministic ids → a no-op on a fresh project.
update public.submissions
set in_gallery = true
where id in (select md5('piqa-seed-submission-' || g)::uuid from generate_series(1, 30) g);

update public.submissions
set is_potd = true
where id = (
  select id from public.submissions
  where drop_id = md5('piqa-seed-drop-1')::uuid
  order by vote_count desc, id
  limit 1
);
