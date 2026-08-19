-- grant_purchase() is the one function every dollar of Phase 3a revenue flows
-- through. This locks in: unknown products are refused, a pack grants every
-- frame mapped to its product_id, webhook event-id redelivery is a no-op, and
-- a second grant call for an already-owned product never double-grants.
begin;
select plan(4);

insert into public.frames
  (id, label, unlock_kind, product_id)
values
  ('test_frame_a', 'Test Frame A', 'purchase', 'test_pack_01'),
  ('test_frame_b', 'Test Frame B', 'purchase', 'test_pack_01')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 'grant-purchase-a@test.piqa');

set role service_role;

select is(
  (public.grant_purchase('evt-unknown', '20000000-0000-0000-0000-000000000001', 'no_such_product', '{}'::jsonb) ->> 'ok')::boolean,
  false,
  'grant_purchase refuses an unrecognized product_id'
);

select public.grant_purchase('evt-1', '20000000-0000-0000-0000-000000000001', 'test_pack_01', '{"source":"test"}'::jsonb);

select is(
  (select count(*)::int from public.user_frames
     where user_id = '20000000-0000-0000-0000-000000000001'
       and frame_id in ('test_frame_a', 'test_frame_b')),
  2,
  'grant_purchase grants every frame mapped to the purchased product_id'
);

select public.grant_purchase('evt-1', '20000000-0000-0000-0000-000000000001', 'test_pack_01', '{}'::jsonb);

select is(
  (select count(*)::int from public.purchase_events where revenuecat_event_id = 'evt-1'),
  1,
  'redelivering the same RevenueCat event id does not duplicate the audit row'
);

select public.grant_purchase('evt-2', '20000000-0000-0000-0000-000000000001', 'test_pack_01', '{}'::jsonb);

select is(
  (select count(*)::int from public.user_frames
     where user_id = '20000000-0000-0000-0000-000000000001'
       and frame_id in ('test_frame_a', 'test_frame_b')),
  2,
  'a new event id for an already-owned product does not grant duplicate ownership rows'
);

select * from finish();
rollback;
