-- supabase/migrations/0033_buddy_removal.sql
--
-- Closes a real gap: an unanswered request or a full 3-buddy roster was a
-- permanent one-way door -- no RPC existed to remove an accepted buddy or
-- cancel a request you sent. Adds two terminal statuses; the existing
-- partial unique index (streak_buddies_pair_idx, 0017) only covers
-- 'pending'/'accepted', so a row moving to either of these frees the pair
-- up for a fresh request automatically, same as 'declined' already does.

do $$
declare
  status_check_name text;
begin
  select conname into status_check_name
  from pg_constraint
  where conrelid = 'public.streak_buddies'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';

  if status_check_name is not null then
    execute format('alter table public.streak_buddies drop constraint %I', status_check_name);
  end if;
end $$;

alter table public.streak_buddies
  add constraint streak_buddies_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled', 'removed'));

-- search_profiles needs to hand back the underlying streak_buddies row id so the
-- client can call cancel_buddy_request on a 'pending_sent' result -- the original
-- shape only ever exposed the relationship label, nothing to act on it with.
drop function public.search_profiles(text);

create function public.search_profiles(query text)
returns table (id uuid, username text, display_name text, avatar_url text, relationship text, request_id uuid)
language plpgsql security definer
as $$
begin
  if length(trim(query)) < 2 then
    return;
  end if;

  return query
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      case
        when sb.status = 'accepted' then 'accepted'
        when sb.status = 'pending' and sb.requester_id = auth.uid() then 'pending_sent'
        when sb.status = 'pending' and sb.recipient_id = auth.uid() then 'pending_received'
        else 'none'
      end,
      sb.id
    from public.profiles p
    left join public.streak_buddies sb
      on ((sb.requester_id = auth.uid() and sb.recipient_id = p.id)
        or (sb.recipient_id = auth.uid() and sb.requester_id = p.id))
      and sb.status in ('pending', 'accepted')
    where p.id <> auth.uid()
      and p.username ilike '%' || trim(query) || '%'
    order by p.username
    limit 10;
end;
$$;

create function public.cancel_buddy_request(request_id uuid)
returns void
language plpgsql security definer
as $$
declare
  req public.streak_buddies%rowtype;
begin
  select * into req from public.streak_buddies where id = request_id;
  if not found or req.requester_id <> auth.uid() or req.status <> 'pending' then
    raise exception 'Request not found';
  end if;

  update public.streak_buddies set status = 'cancelled', responded_at = now() where id = request_id;
end;
$$;

create function public.remove_buddy(buddy_id uuid)
returns void
language plpgsql security definer
as $$
declare
  rel public.streak_buddies%rowtype;
begin
  select * into rel from public.streak_buddies where id = buddy_id;
  if not found
     or rel.status <> 'accepted'
     or (rel.requester_id <> auth.uid() and rel.recipient_id <> auth.uid())
  then
    raise exception 'Buddy not found';
  end if;

  update public.streak_buddies set status = 'removed', responded_at = now() where id = buddy_id;
end;
$$;
