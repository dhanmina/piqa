-- supabase/migrations/0034_buddy_peek.sql
--
-- "Buddy Peek": surfaces a moment where you and an accepted buddy each
-- captured on the same historical point relative to today (7 days / 1
-- month / 1 year ago), reusing get_peek_back's own offset priority and
-- sequential-fallback shape (0004/0031) rather than inventing a new
-- matching system, per the architecture spec's own instruction.

-- A capture from one of the 3 peek offsets is only visible to a buddy if
-- the buddy ALSO captured on that exact day -- reciprocity, not a standing
-- grant to "any photo from exactly N days ago". Without this, a buddy
-- could poll the fixed offsets daily and slowly harvest arbitrary single
-- days from your archive, which is exactly the "no free exploration"
-- boundary the spec calls out. Shared by both the storage policy below and
-- react_to_capture, so the two checks can't drift apart.
create function public.is_reciprocal_peek_date(p_date date)
returns boolean
language sql security definer stable
as $$
  select p_date in (current_date - 7, (current_date - interval '1 month')::date, (current_date - interval '1 year')::date)
    and exists (select 1 from public.captures where user_id = auth.uid() and captured_at = p_date);
$$;

create or replace function public.can_view_buddy_capture(object_name text)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.captures c
    join public.streak_buddies sb on sb.status = 'accepted'
      and ((sb.requester_id = auth.uid() and sb.recipient_id = c.user_id)
        or (sb.recipient_id = auth.uid() and sb.requester_id = c.user_id))
    where c.storage_path = object_name
      and (c.captured_at = current_date or public.is_reciprocal_peek_date(c.captured_at))
  );
$$;

create or replace function public.react_to_capture(target_capture_id uuid)
returns void
language plpgsql security definer
as $$
declare
  owner_id uuid;
  capture_date date;
begin
  select user_id, captured_at into owner_id, capture_date
  from public.captures where id = target_capture_id;

  if owner_id is null then
    raise exception 'Capture not found';
  end if;
  if not (capture_date = current_date or public.is_reciprocal_peek_date(capture_date)) then
    raise exception 'Can only react to today''s capture or a shared Buddy Peek moment';
  end if;
  if not exists (
    select 1 from public.streak_buddies
    where status = 'accepted'
      and ((requester_id = auth.uid() and recipient_id = owner_id)
        or (requester_id = owner_id and recipient_id = auth.uid()))
  ) then
    raise exception 'Not an accepted buddy';
  end if;

  insert into public.reactions (capture_id, reactor_id)
  values (target_capture_id, auth.uid())
  on conflict (capture_id, reactor_id) do nothing;
end;
$$;

-- Only the first match wins, checked in the same 7d -> 1mo -> 1yr priority
-- order as get_peek_back -- naturally rare, so it stays a surprise rather
-- than a mini-feed of every qualifying buddy/offset combination.
create function public.get_buddy_peek(p_today date default current_date)
returns table (
  buddy_id uuid,
  buddy_username text,
  buddy_display_name text,
  buddy_avatar_url text,
  my_capture_id uuid,
  my_storage_path text,
  buddy_capture_id uuid,
  buddy_storage_path text,
  captured_at date,
  label text,
  reacted_by_me boolean
)
language plpgsql security definer
as $$
declare
  today date := p_today;
begin
  return query
    select p.id, p.username, p.display_name, p.avatar_url,
      my_cap.id, my_cap.storage_path, buddy_cap.id, buddy_cap.storage_path,
      my_cap.captured_at, 'last week',
      exists (select 1 from public.reactions where capture_id = buddy_cap.id and reactor_id = auth.uid())
    from public.streak_buddies sb
    join public.profiles p
      on p.id = case when sb.requester_id = auth.uid() then sb.recipient_id else sb.requester_id end
    join public.captures my_cap on my_cap.user_id = auth.uid() and my_cap.captured_at = today - 7
    join public.captures buddy_cap on buddy_cap.user_id = p.id and buddy_cap.captured_at = today - 7
    where sb.status = 'accepted' and (sb.requester_id = auth.uid() or sb.recipient_id = auth.uid())
    order by p.id
    limit 1;
  if found then return; end if;

  return query
    select p.id, p.username, p.display_name, p.avatar_url,
      my_cap.id, my_cap.storage_path, buddy_cap.id, buddy_cap.storage_path,
      my_cap.captured_at, 'last month',
      exists (select 1 from public.reactions where capture_id = buddy_cap.id and reactor_id = auth.uid())
    from public.streak_buddies sb
    join public.profiles p
      on p.id = case when sb.requester_id = auth.uid() then sb.recipient_id else sb.requester_id end
    join public.captures my_cap on my_cap.user_id = auth.uid() and my_cap.captured_at = today - interval '1 month'
    join public.captures buddy_cap on buddy_cap.user_id = p.id and buddy_cap.captured_at = today - interval '1 month'
    where sb.status = 'accepted' and (sb.requester_id = auth.uid() or sb.recipient_id = auth.uid())
    order by p.id
    limit 1;
  if found then return; end if;

  return query
    select p.id, p.username, p.display_name, p.avatar_url,
      my_cap.id, my_cap.storage_path, buddy_cap.id, buddy_cap.storage_path,
      my_cap.captured_at, 'a year ago',
      exists (select 1 from public.reactions where capture_id = buddy_cap.id and reactor_id = auth.uid())
    from public.streak_buddies sb
    join public.profiles p
      on p.id = case when sb.requester_id = auth.uid() then sb.recipient_id else sb.requester_id end
    join public.captures my_cap on my_cap.user_id = auth.uid() and my_cap.captured_at = today - interval '1 year'
    join public.captures buddy_cap on buddy_cap.user_id = p.id and buddy_cap.captured_at = today - interval '1 year'
    where sb.status = 'accepted' and (sb.requester_id = auth.uid() or sb.recipient_id = auth.uid())
    order by p.id
    limit 1;
end;
$$;
