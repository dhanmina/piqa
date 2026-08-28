-- supabase/migrations/0013_streak_buddies.sql
create table public.streak_buddies (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);

create index streak_buddies_requester_idx on public.streak_buddies (requester_id, status);
create index streak_buddies_recipient_idx on public.streak_buddies (recipient_id, status);

alter table public.streak_buddies enable row level security;

create policy "streak_buddies_select_own" on public.streak_buddies
  for select using (auth.uid() = requester_id or auth.uid() = recipient_id);

grant select on public.streak_buddies to authenticated;

-- No insert/update policy: the cap check and duplicate check both span
-- rows the caller isn't a participant in (the other side's OTHER
-- relationships), which a per-row RLS USING clause can't express. All
-- writes go through the SECURITY DEFINER functions below instead.

create function public.search_profiles(query text)
returns table (id uuid, username text, display_name text, avatar_url text, relationship text)
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
      end
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

create function public.send_buddy_request(recipient_username text)
returns uuid
language plpgsql security definer
as $$
declare
  recipient public.profiles%rowtype;
  new_id uuid;
begin
  select * into recipient from public.profiles where username = recipient_username;
  if not found then
    raise exception 'No one found with that username';
  end if;
  if recipient.id = auth.uid() then
    raise exception 'You can''t add yourself';
  end if;

  if exists (
    select 1 from public.streak_buddies
    where status in ('pending', 'accepted')
      and ((requester_id = auth.uid() and recipient_id = recipient.id)
        or (requester_id = recipient.id and recipient_id = auth.uid()))
  ) then
    raise exception 'A request already exists with this person';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  if (select count(*) from public.streak_buddies
      where status = 'accepted' and (requester_id = auth.uid() or recipient_id = auth.uid())) >= 3 then
    raise exception 'You already have 3 buddies';
  end if;

  insert into public.streak_buddies (requester_id, recipient_id)
  values (auth.uid(), recipient.id)
  returning id into new_id;

  return new_id;
end;
$$;

create function public.respond_buddy_request(request_id uuid, accept boolean)
returns void
language plpgsql security definer
as $$
declare
  req public.streak_buddies%rowtype;
begin
  select * into req from public.streak_buddies where id = request_id;
  if not found or req.recipient_id <> auth.uid() or req.status <> 'pending' then
    raise exception 'Request not found';
  end if;

  if accept then
    if req.requester_id::text < auth.uid()::text then
      perform pg_advisory_xact_lock(hashtext(req.requester_id::text));
      perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
    else
      perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
      perform pg_advisory_xact_lock(hashtext(req.requester_id::text));
    end if;

    if (select count(*) from public.streak_buddies
        where status = 'accepted' and (requester_id = req.requester_id or recipient_id = req.requester_id)) >= 3
    or (select count(*) from public.streak_buddies
        where status = 'accepted' and (requester_id = auth.uid() or recipient_id = auth.uid())) >= 3
    then
      raise exception 'Buddy cap reached';
    end if;
    update public.streak_buddies set status = 'accepted', responded_at = now() where id = request_id;
  else
    update public.streak_buddies set status = 'declined', responded_at = now() where id = request_id;
  end if;
end;
$$;
