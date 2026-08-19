-- Purchase pipeline (Phase 3a) — frames as the first sellable cosmetic. Additive:
-- extends the existing frames/user_frames catalog rather than a new ownership
-- model. grant_purchase() is the ONLY writer of purchase-sourced user_frames rows,
-- called by the revenuecat-webhook and revenuecat-sync edge functions with the
-- service role — never reachable by a client. Mirrors claim_event_frame()'s shape
-- (a single server-checked grant path) but for money instead of a calendar window.

-- ---------------------------------------------------------------------------
-- 1. product_id on frames + 'purchase' as a valid unlock_kind
-- ---------------------------------------------------------------------------
alter table public.frames add column if not exists product_id text;

alter table public.frames drop constraint if exists frames_unlock_kind_check;
alter table public.frames add constraint frames_unlock_kind_check
  check (unlock_kind in ('default','potd','event','manual','purchase'));

-- ---------------------------------------------------------------------------
-- 2. purchase_events — audit + idempotency log. No RLS policies at all: not
--    even the owning user can read this directly (ownership itself is read
--    from user_frames). service_role bypasses RLS, which is the only way in.
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_events (
  id                  uuid primary key default gen_random_uuid(),
  revenuecat_event_id text not null unique,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  product_id          text not null,
  raw_event           jsonb not null default '{}'::jsonb,
  processed_at        timestamptz not null default now()
);

alter table public.purchase_events enable row level security;

-- ---------------------------------------------------------------------------
-- 3. grant_purchase — see file header. p_event_id is the RevenueCat event id for
--    a webhook call (the dedupe key: RevenueCat redelivers), or null for the
--    restore/sync path, which has no event id and is instead deduped by checking
--    user_frames ownership directly (a synthetic id still gets written for the
--    audit row, since revenuecat_event_id is not-null-unique). A product_id can
--    map to MORE THAN ONE frame row (a "pack" sold as one product) — every
--    matching frame is granted in one call.
-- ---------------------------------------------------------------------------
create or replace function public.grant_purchase(
  p_event_id text,
  p_user uuid,
  p_product text,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  eid text := coalesce(p_event_id, 'sync:' || gen_random_uuid()::text);
  granted text[] := '{}';
  r record;
begin
  if current_setting('role') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  if p_event_id is not null and exists (
    select 1 from public.purchase_events where revenuecat_event_id = p_event_id
  ) then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  if not exists (select 1 from public.frames where product_id = p_product) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  for r in select id from public.frames where product_id = p_product loop
    insert into public.user_frames (user_id, frame_id) values (p_user, r.id)
    on conflict (user_id, frame_id) do nothing;

    if found then
      granted := array_append(granted, r.id);
    end if;
  end loop;

  insert into public.purchase_events (revenuecat_event_id, user_id, product_id, raw_event)
  values (eid, p_user, p_product, p_raw)
  on conflict (revenuecat_event_id) do nothing;

  return jsonb_build_object('ok', true, 'granted', to_jsonb(granted));
end;
$$;

revoke execute on function public.grant_purchase(text, uuid, text, jsonb) from public, anon, authenticated;
grant  execute on function public.grant_purchase(text, uuid, text, jsonb) to service_role;

-- service_role needs to read frames, user_frames, and purchase_events for the function to work
grant select on public.frames to service_role;
grant select, insert on public.user_frames to service_role;
grant select, insert on public.purchase_events to service_role;

-- ---------------------------------------------------------------------------
-- 4. The first purchasable cosmetic: a two-frame pack. Colors/suffix only —
--    a custom marker glyph is a separate design pass, out of scope here (the
--    default triangle marker renders when marker_svg is null, same as the
--    'default' frame).
-- ---------------------------------------------------------------------------
insert into public.frames
  (id, label, hairline_color, hairline_opacity, counter_color, suffix_text,
   suffix_color, ring_color, unlock_kind, unlock_label, product_id)
values
  ('goldenhour', 'Golden Hour', '#E8A33D', 0.5, '#F2EDE4', '· GOLDEN HOUR',
   '#E8A33D', '#E8A33D', 'purchase', 'Golden & Blue Hour pack', 'piqa_frame_pack_01'),
  ('bluehour', 'Blue Hour', '#3D6FE8', 0.5, '#F2EDE4', '· BLUE HOUR',
   '#3D6FE8', '#3D6FE8', 'purchase', 'Golden & Blue Hour pack', 'piqa_frame_pack_01')
on conflict (id) do nothing;
