-- Fix discovered during Task 10 device verification: RevenueCat's v2 Customer API
-- (used by revenuecat-sync to reconcile purchases) returns a *different* product
-- identifier space than webhook events do.
--
--   - revenuecat-webhook's event.product_id is the STORE's own product identifier
--     (what we set as frames.product_id, e.g. 'piqa_frame_pack_01') — unchanged,
--     this path already worked correctly.
--   - GET /v2/projects/{project_id}/customers/{id}/purchases returns RevenueCat's
--     own INTERNAL product object id (e.g. 'prodcefa2223e3') in its product_id
--     field, not the store identifier. Confirmed live against the real API.
--
-- Rather than have revenuecat-sync make an extra authenticated call to RevenueCat's
-- Products endpoint to resolve one id to the other (a real REST API call, another
-- permission scope, another failure mode), frames now carries both identifiers and
-- grant_purchase matches on either — the two edge functions keep calling it exactly
-- the same way, just occasionally passing a different kind of id in p_product.

alter table public.frames add column if not exists revenuecat_product_id text;

update public.frames
set revenuecat_product_id = 'prodcefa2223e3'
where product_id = 'piqa_frame_pack_01';

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

  if not exists (
    select 1 from public.frames where product_id = p_product or revenuecat_product_id = p_product
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  for r in
    select id from public.frames
    where product_id = p_product or revenuecat_product_id = p_product
  loop
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
