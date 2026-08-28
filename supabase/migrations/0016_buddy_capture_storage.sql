-- Buddies can read a today capture's storage object once they have an
-- accepted streak_buddies relationship with its owner. Scoped to
-- captured_at = current_date only (not the owner's whole archive) to
-- preserve the spec's "never free exploration of your archive" boundary
-- — get_buddies() only ever surfaces today's capture, so this matches
-- exactly what the app actually needs a buddy to see.
create function public.can_view_buddy_capture(object_name text)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.captures c
    join public.streak_buddies sb on sb.status = 'accepted'
      and ((sb.requester_id = auth.uid() and sb.recipient_id = c.user_id)
        or (sb.recipient_id = auth.uid() and sb.requester_id = c.user_id))
    where c.storage_path = object_name and c.captured_at = current_date
  );
$$;

create policy "captures_storage_select_buddy_today" on storage.objects
  for select using (bucket_id = 'captures' and public.can_view_buddy_capture(name));
