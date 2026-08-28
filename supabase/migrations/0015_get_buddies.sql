-- supabase/migrations/0015_get_buddies.sql
create function public.get_buddies()
returns table (
  buddy_id uuid,
  username text,
  display_name text,
  avatar_url text,
  current_count int,
  status text,
  today_capture_id uuid,
  today_storage_path text,
  reacted_by_me boolean
)
language plpgsql security definer
as $$
declare
  today date := current_date;
begin
  return query
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      coalesce(s.current_count, 0),
      case
        when c.id is not null then 'captured_today'
        when fd.date is not null then 'frozen_today'
        when coalesce(s.current_count, 0) > 0 then 'at_risk'
        else 'none'
      end,
      c.id,
      c.storage_path,
      exists(select 1 from public.reactions r where r.capture_id = c.id and r.reactor_id = auth.uid())
    from public.streak_buddies sb
    join public.profiles p
      on p.id = case when sb.requester_id = auth.uid() then sb.recipient_id else sb.requester_id end
    left join public.streaks s on s.user_id = p.id
    left join public.frozen_dates fd on fd.user_id = p.id and fd.date = today
    left join lateral (
      select cc.id, cc.storage_path
      from public.captures cc
      where cc.user_id = p.id and cc.captured_at = today
      order by cc.created_at desc
      limit 1
    ) c on true
    where sb.status = 'accepted'
      and (sb.requester_id = auth.uid() or sb.recipient_id = auth.uid())
    order by p.display_name nulls last, p.username;
end;
$$;

create function public.get_pending_requests()
returns table (request_id uuid, requester_id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql security definer
as $$
  select sb.id, p.id, p.username, p.display_name, p.avatar_url, sb.created_at
  from public.streak_buddies sb
  join public.profiles p on p.id = sb.requester_id
  where sb.recipient_id = auth.uid() and sb.status = 'pending'
  order by sb.created_at asc;
$$;
