create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.captures(id) on delete cascade,
  reactor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (capture_id, reactor_id)
);

alter table public.reactions enable row level security;

-- A user can see their own reaction rows (so "did I already react" is a
-- plain query) but not who else reacted — that read is deliberately not
-- built this pass (see plan's "explicitly out of scope").
create policy "reactions_select_own" on public.reactions
  for select using (auth.uid() = reactor_id);

grant select on public.reactions to authenticated;

create function public.react_to_capture(target_capture_id uuid)
returns void
language plpgsql security definer
as $$
declare
  owner_id uuid;
  is_today boolean;
begin
  select user_id, (captured_at = current_date) into owner_id, is_today
  from public.captures where id = target_capture_id;

  if owner_id is null then
    raise exception 'Capture not found';
  end if;
  if not is_today then
    raise exception 'Can only react to today''s capture';
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
