-- Generic user badge system — handles beta testers, achievements, milestones, perks.
create table if not exists public.user_badges (
  user_id    uuid references auth.users(id) on delete cascade,
  badge_type text not null,
  earned_at  timestamptz not null default now(),
  metadata   jsonb,
  primary key (user_id, badge_type)
);

alter table public.user_badges enable row level security;

create policy "user can read own badges" on public.user_badges
  for select using (user_id = auth.uid());

create policy "admin can read all badges" on public.user_badges
  for select using (public.is_admin());

-- Helper: check if a user has a specific badge.
create or replace function public.has_badge(p_user uuid, p_badge text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.user_badges where user_id = p_user and badge_type = p_badge);
$$;

-- Helper: return all badge types for a user.
create or replace function public.get_user_badges(p_user uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(ub.badge_type order by ub.earned_at), '[]'::jsonb)
  from public.user_badges ub
  where ub.user_id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

-- List all users with a specific badge (or all badges if p_badge is null).
create or replace function public.admin_list_badges(p_badge text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return coalesce((
    select jsonb_agg(row order by (row->>'earned_at') desc)
    from (
      select jsonb_build_object(
               'user_id', ub.user_id,
               'username', p.username,
               'badge_type', ub.badge_type,
               'earned_at', ub.earned_at,
               'metadata', ub.metadata
             ) as row
      from public.user_badges ub
      join public.profiles p on p.id = ub.user_id
      where p_badge is null or ub.badge_type = p_badge
      order by ub.earned_at desc
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_list_badges(text) from public, anon;
grant  execute on function public.admin_list_badges(text) to authenticated;

-- Grant a badge to a user (idempotent).
create or replace function public.admin_grant_badge(p_user uuid, p_badge text, p_metadata jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof_exists boolean;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  select exists(select 1 from public.profiles where id = p_user) into prof_exists;
  if not prof_exists then return jsonb_build_object('ok', false, 'reason', 'user_not_found'); end if;

  insert into public.user_badges (user_id, badge_type, metadata)
  values (p_user, p_badge, p_metadata)
  on conflict (user_id, badge_type) do update
    set metadata = coalesce(excluded.metadata, user_badges.metadata);

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (uid, 'badge.grant', 'user_badges', p_user || ':' || p_badge,
          jsonb_build_object('badge_type', p_badge, 'metadata', p_metadata));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_grant_badge(uuid, text, jsonb) from public, anon;
grant  execute on function public.admin_grant_badge(uuid, text, jsonb) to authenticated;

-- Revoke a badge from a user.
create or replace function public.admin_revoke_badge(p_user uuid, p_badge text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;

  delete from public.user_badges where user_id = p_user and badge_type = p_badge;

  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values (uid, 'badge.revoke', 'user_badges', p_user || ':' || p_badge,
          jsonb_build_object('badge_type', p_badge));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_revoke_badge(uuid, text) from public, anon;
grant  execute on function public.admin_revoke_badge(uuid, text) to authenticated;

-- Backfill: all existing users become beta testers.
insert into public.user_badges (user_id, badge_type, metadata)
select id, 'beta_tester', jsonb_build_object('phase', 'beta_1', 'migrated', true)
from public.profiles
on conflict do nothing;
