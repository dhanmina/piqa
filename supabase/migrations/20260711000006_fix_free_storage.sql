-- Fix free-shot storage RLS. The original policies matched the archive folder
-- via (storage.foldername(name))[2] = auth.uid(), which did not match in
-- practice — so uploads to free/{uid}/{id}.jpg (the practice-shot / archive
-- path used by the capture queue) were rejected. Replace with an unambiguous
-- prefix check: name like 'free/{uid}/%'. Daily submissions keep the
-- filename check ({uid}.jpg) which works correctly.

drop policy if exists "users write own submission objects" on storage.objects;
drop policy if exists "users read own submission objects" on storage.objects;
drop policy if exists "users delete own submission objects" on storage.objects;

create policy "users write own submission objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions' and (
      storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
      or name like ('free/' || auth.uid()::text || '/%')
    )
  );

create policy "users read own submission objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions' and (
      storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
      or name like ('free/' || auth.uid()::text || '/%')
    )
  );

create policy "users delete own submission objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions' and (
      storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
      or name like ('free/' || auth.uid()::text || '/%')
    )
  );
