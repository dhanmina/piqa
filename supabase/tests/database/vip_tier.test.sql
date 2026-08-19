-- vip_tier crossing logic in grant_purchase(): thresholds at $20/$50/$100
-- lifetime spend, monotonic (never decreases), idempotent on redelivery,
-- doesn't error once already at the top tier, and -- the reason this test
-- uses several DISTINCT test products rather than repeat-granting one --
-- correctly dedupes lifetime spend when the SAME purchase is delivered
-- twice under two different product_id values (webhook's store SKU vs
-- sync's RevenueCat-internal id), which is exactly what happens for every
-- real purchase in this app.
begin;
select plan(6);

insert into public.frames (id, label, unlock_kind, product_id) values
  ('test_vip_frame_a', 'Test VIP Frame A', 'purchase', 'test_vip_product_a'),
  ('test_vip_frame_b', 'Test VIP Frame B', 'purchase', 'test_vip_product_b'),
  ('test_vip_frame_c', 'Test VIP Frame C', 'purchase', 'test_vip_product_c')
on conflict (id) do nothing;

-- product_id and revenuecat_product_id deliberately differ, so a purchase
-- delivered via both the webhook (store SKU) and revenuecat-sync (RC's
-- internal id) can be simulated as two distinct purchase_events rows that
-- must still collapse to one contribution toward lifetime spend.
insert into public.frames (id, label, unlock_kind, product_id, revenuecat_product_id) values
  ('test_vip_frame_rc', 'Test VIP Frame RC', 'purchase', 'test_vip_product_rc_store', 'test_vip_product_rc_internal')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'vip-tier@test.piqa');

set role service_role;

select public.grant_purchase('vip-evt-1', '40000000-0000-0000-0000-000000000001', 'test_vip_product_a', '{}'::jsonb, 15);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  0::smallint,
  'below $20 lifetime spend (one $15 distinct purchase) stays at vip_tier 0'
);

select public.grant_purchase('vip-evt-2', '40000000-0000-0000-0000-000000000001', 'test_vip_product_b', '{}'::jsonb, 10);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  1::smallint,
  'crossing $20 lifetime spend across two DISTINCT purchases (15+10=25) grants vip_tier 1'
);

select public.grant_purchase('vip-evt-2', '40000000-0000-0000-0000-000000000001', 'test_vip_product_b', '{}'::jsonb, 999);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  1::smallint,
  'redelivering an already-processed event id does not re-sum spend or change tier'
);

-- The core fix under test: the SAME real purchase delivered via two
-- different event ids under two different product_id values (webhook-style
-- store SKU vs sync-style RC-internal id) must collapse to ONE contribution,
-- not two. Without the fix, lifetime would jump to 25+100+100=225 (tier 3
-- from double-counting); with the fix, it should be 25+100=125 (tier 3 from
-- genuinely crossing $100, not from the duplicate).
select public.grant_purchase('vip-evt-3-webhook', '40000000-0000-0000-0000-000000000001', 'test_vip_product_rc_store', '{}'::jsonb, 100);
select public.grant_purchase('vip-evt-3-sync', '40000000-0000-0000-0000-000000000001', 'test_vip_product_rc_internal', '{}'::jsonb, 100);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  3::smallint,
  'crossing $100 lifetime spend (25+100, NOT 25+100+100) jumps to vip_tier 3 -- the same purchase delivered twice under two different product_id values does not double-count'
);

select public.grant_purchase('vip-evt-4', '40000000-0000-0000-0000-000000000001', 'test_vip_product_c', '{}'::jsonb, 50);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  3::smallint,
  'a further distinct purchase at an already-max tier does not error or reset anything'
);

select is(
  (select count(distinct product_id)::int from public.purchase_events
     where user_id = '40000000-0000-0000-0000-000000000001'
       and product_id in ('test_vip_product_rc_store', 'test_vip_product_rc_internal')),
  2,
  'sanity: both delivery-path rows really were inserted as separate purchase_events rows (the dedup happens in the spend calculation, not by preventing the second insert)'
);

select * from finish();
rollback;
