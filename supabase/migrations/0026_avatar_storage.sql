-- Avatar photos are shown everywhere a buddy's profile appears (BuddyRow,
-- PendingRequestRow, add-buddy search) as a plain avatar_url string, same
-- as the OAuth-provided avatars already in that column -- so this bucket is
-- public (getPublicUrl, no signed-url plumbing) rather than private like
-- 'captures', which stays access-controlled because it's the private archive.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "avatars_storage_insert_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_storage_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_storage_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
