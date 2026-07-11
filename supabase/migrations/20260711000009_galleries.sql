-- Phase 3 · Serving architecture (spec §14): the day's gallery is materialized
-- as ONE static JSON blob per drop so the 9am morning rush reads a cached row,
-- never a live query/view. Past galleries are immutable → cache forever.
--
-- We store thumb *paths* (stable), not signed URLs (which expire in ~1h and
-- therefore can't be "cached forever"); the client batch-signs on read — the
-- pattern already used in lib/gallery.ts.

create table public.galleries (
  drop_id    uuid primary key references public.prompt_drops (id) on delete cascade,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.galleries enable row level security;

-- Galleries are public once written (a gallery only exists after close_day, and
-- close_day only reveals a drop whose region has fully closed). Read for all
-- authed users; writes happen through security-definer functions / service role.
create policy "galleries readable by authed users"
  on public.galleries for select to authenticated using (true);

grant select on public.galleries to authenticated;
grant all    on public.galleries to service_role;

-- ---------------------------------------------------------------------------
-- Config helpers — every threshold lives in the config table (spec §13).
-- Values are jsonb scalars (e.g. 50, true); #>> '{}' extracts the text form.
-- ---------------------------------------------------------------------------
create or replace function public.cfg_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::int from public.config where key = p_key), p_default);
$$;

create or replace function public.cfg_num(p_key text, p_default double precision)
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::double precision from public.config where key = p_key), p_default);
$$;

create or replace function public.cfg_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::boolean from public.config where key = p_key), p_default);
$$;

revoke execute on function public.cfg_int(text, int)               from public, anon;
revoke execute on function public.cfg_num(text, double precision)  from public, anon;
revoke execute on function public.cfg_bool(text, boolean)          from public, anon;
grant  execute on function public.cfg_int(text, int)               to authenticated, service_role;
grant  execute on function public.cfg_num(text, double precision)  to authenticated, service_role;
grant  execute on function public.cfg_bool(text, boolean)          to authenticated, service_role;
