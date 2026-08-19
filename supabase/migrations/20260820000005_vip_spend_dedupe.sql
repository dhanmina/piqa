-- Final-review fix: purchase_events gets one row per delivery path for the
-- SAME real purchase (revenuecat-webhook logs the store SKU as product_id,
-- revenuecat-sync logs RevenueCat's internal product id for the same
-- product -- see migration 20260819120000). The old sum(amount_usd) counted
-- both, roughly doubling every user's recorded lifetime spend. Fix: group by
-- the canonical STORE product id (frames.product_id, resolved via either id
-- column) and take max() per group before summing. This is correct because
-- every catalog item here is a one-time non-consumable -- multiple
-- purchase_events rows resolving to the same canonical product are duplicate
-- deliveries of one purchase, not repeat purchases (Play Billing doesn't let
-- you buy an already-owned non-consumable again). A multi-frame pack (many
-- frames sharing one product_id, e.g. the Golden/Blue Hour pack) still
-- contributes exactly once, since the group key is the shared product_id
-- itself, not the frame id.

create or replace function public.grant_purchase(
  p_event_id text,
  p_user uuid,
  p_product text,
  p_raw jsonb default '{}'::jsonb,
  p_amount_usd numeric default null
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
  lifetime numeric;
  new_tier smallint;
begin
  if current_setting('role') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  if p_event_id is not null and exists (
    select 1 from public.purchase_events where revenuecat_event_id = p_event_id
  ) then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_user');
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

  insert into public.purchase_events (revenuecat_event_id, user_id, product_id, raw_event, amount_usd)
  values (eid, p_user, p_product, p_raw, p_amount_usd)
  on conflict (revenuecat_event_id) do nothing;

  select coalesce(sum(g.amt), 0) into lifetime
  from (
    select f.product_id as canonical_product, max(pe.amount_usd) as amt
    from public.purchase_events pe
    join public.frames f on f.product_id = pe.product_id or f.revenuecat_product_id = pe.product_id
    where pe.user_id = p_user
    group by f.product_id
  ) g;

  new_tier := case
    when lifetime >= 100 then 3
    when lifetime >= 50 then 2
    when lifetime >= 20 then 1
    else 0
  end;

  update public.profiles set vip_tier = new_tier
  where id = p_user and vip_tier < new_tier;

  return jsonb_build_object('ok', true, 'granted', to_jsonb(granted));
end;
$$;

revoke execute on function public.grant_purchase(text, uuid, text, jsonb, numeric) from public, anon, authenticated;
grant  execute on function public.grant_purchase(text, uuid, text, jsonb, numeric) to service_role;
