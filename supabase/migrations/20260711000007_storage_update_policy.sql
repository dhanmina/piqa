-- The capture queue uploads with upsert:true so a retried upload overwrites a
-- partially-uploaded object cleanly. Overwrite is an UPDATE on storage.objects,
-- which had no policy — so any re-upload of an existing object was rejected.
-- Add an update policy mirroring the insert/select/delete ones.

create policy "users update own submission objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'submissions' and (
      storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
      or name like ('free/' || auth.uid()::text || '/%')
    )
  )
  with check (
    bucket_id = 'submissions' and (
      storage.filename(name) ~ ('^' || auth.uid()::text || '(_thumb)?\.jpg$')
      or name like ('free/' || auth.uid()::text || '/%')
    )
  );
