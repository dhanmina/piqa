-- VIP loyalty badges (spec §3). Tracks lifetime cosmetic spend and grants a
-- badge tier automatically -- not purchasable, not equippable, never
-- decreases. grant_purchase() gains one optional parameter (p_amount_usd) and
-- one extra step after the existing frame-grant logic: sum amount_usd across
-- the user's purchase_events, compare against the 3 thresholds, bump
-- profiles.vip_tier if newly crossed. vip_tier only ever increases -- a
-- refunded purchase still counts (Phase 3a doesn't handle refunds either; see
-- spec §3.2).

alter table public.purchase_events add column if not exists amount_usd numeric;
alter table public.profiles add column if not exists vip_tier smallint not null default 0
  check (vip_tier between 0 and 3);

-- One-time backfill for any purchase_events written before amount_usd existed:
-- nothing to backfill yet (Phase 3a's only purchase events pre-date this
-- column and have amount_usd null, contributing 0 to the sum below -- correct,
-- since we have no historical price data for them).

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

  select coalesce(sum(amount_usd), 0) into lifetime
  from public.purchase_events where user_id = p_user;

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

-- The old 4-arg signature is superseded -- drop it so there is exactly one
-- grant_purchase to call (Postgres allows overloads; this project doesn't want one).
drop function if exists public.grant_purchase(text, uuid, text, jsonb);
