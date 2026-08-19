-- vip_tier crossing logic in grant_purchase(): thresholds at $20/$50/$100
-- lifetime spend, monotonic (never decreases), idempotent on redelivery,
-- doesn't error once already at the top tier.
begin;
select plan(5);

insert into public.frames (id, label, unlock_kind, product_id) values
  ('test_vip_frame', 'Test VIP Frame', 'purchase', 'test_vip_product')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'vip-tier@test.piqa');

set role service_role;

select public.grant_purchase('vip-evt-1', '40000000-0000-0000-0000-000000000001', 'test_vip_product', '{}'::jsonb, 15);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  0::smallint,
  'below $20 lifetime spend stays at vip_tier 0'
);

select public.grant_purchase('vip-evt-2', '40000000-0000-0000-0000-000000000001', 'test_vip_product', '{}'::jsonb, 10);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  1::smallint,
  'crossing $20 lifetime spend (15+10=25) grants vip_tier 1'
);

select public.grant_purchase('vip-evt-2', '40000000-0000-0000-0000-000000000001', 'test_vip_product', '{}'::jsonb, 999);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  1::smallint,
  'redelivering an already-processed event id does not re-sum spend or change tier'
);

select public.grant_purchase('vip-evt-3', '40000000-0000-0000-0000-000000000001', 'test_vip_product', '{}'::jsonb, 100);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  3::smallint,
  'crossing $100 lifetime spend jumps straight to vip_tier 3 (no need to land on 1/2 first)'
);

select public.grant_purchase('vip-evt-4', '40000000-0000-0000-0000-000000000001', 'test_vip_product', '{}'::jsonb, 50);

select is(
  (select vip_tier from public.profiles where id = '40000000-0000-0000-0000-000000000001'),
  3::smallint,
  'a further purchase at an already-max tier does not error or reset anything'
);

select * from finish();
rollback;
