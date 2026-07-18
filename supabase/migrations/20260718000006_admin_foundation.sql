-- Admin foundation — the security seam for the piqa-admin control room.
--
--  * profiles.is_admin  — the only bit that grants power. Set it by hand in the
--    Supabase SQL editor for the first admin; the dashboard never toggles it.
--  * is_admin()         — one helper every admin RLS policy and RPC calls.
--  * audit_log          — every privileged write lands here (who / what / before
--    / after), admin-readable only, written by security-definer RPCs.
--  * admin_set_config   — the first privileged write path: upsert a config row and
--    record the change. Runs as definer but refuses anyone who isn't an admin, so
--    the browser only ever needs the anon key + the admin's own session.
--
-- No service_role key ever reaches the client: reads go through admin-gated RLS,
-- writes go through definer RPCs that assert is_admin() first.

-- ---------------------------------------------------------------------------
-- is_admin flag + helper
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = p_uid),
    false
  );
$$;

revoke execute on function public.is_admin(uuid) from public, anon;
grant  execute on function public.is_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- audit_log — the system of record for admin actions
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,             -- e.g. 'config.update'
  entity     text not null,             -- e.g. 'config'
  entity_id  text,                      -- e.g. the config key
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx  on public.audit_log (entity, entity_id);

alter table public.audit_log enable row level security;

-- Admins read the whole log; nobody writes it directly (definer RPCs do).
create policy "admins read audit log"
  on public.audit_log for select to authenticated
  using (public.is_admin());

grant select on public.audit_log to authenticated;
grant all    on public.audit_log to service_role;

-- ---------------------------------------------------------------------------
-- admin_read_config — grouped current values (config is already world-readable
-- to authed users, but this keeps the admin surface on one auditable RPC and
-- lets us fail closed for non-admins later without touching app reads).
-- ---------------------------------------------------------------------------
create or replace function public.admin_read_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce(
    (select jsonb_object_agg(key, value) from public.config),
    '{}'::jsonb
  );
end;
$$;

revoke execute on function public.admin_read_config() from public, anon;
grant  execute on function public.admin_read_config() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_config — upsert one config key, audited. Refuses non-admins.
-- Returns the old and new value so the client can confirm the diff it showed.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  old_value jsonb;
begin
  if not public.is_admin(uid) then
    raise exception 'not_authorized';
  end if;
  if p_key is null or char_length(trim(p_key)) = 0 then
    raise exception 'bad_key';
  end if;

  select value into old_value from public.config where key = p_key;

  -- No-op writes still return, but we only log real changes.
  insert into public.config (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  if old_value is distinct from p_value then
    insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
    values (uid, 'config.update', 'config', p_key, old_value, p_value);
  end if;

  return jsonb_build_object('ok', true, 'key', p_key, 'before', old_value, 'after', p_value);
end;
$$;

revoke execute on function public.admin_set_config(text, jsonb) from public, anon;
grant  execute on function public.admin_set_config(text, jsonb) to authenticated;
