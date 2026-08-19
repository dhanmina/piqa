-- grant_purchase() is the one function every dollar of Phase 3a revenue flows
-- through. This locks in: unknown products are refused, a pack grants every
-- frame mapped to its product_id (matching on EITHER product_id or
-- revenuecat_product_id — the two id spaces the webhook and sync paths each send),
-- webhook event-id redelivery is a no-op, a second grant call for an already-owned
-- product never double-grants, an unresolvable p_user is refused cleanly instead of
-- raising an FK exception, and only service_role may call it at all.
begin;
select plan(7);

insert into public.frames
  (id, label, unlock_kind, product_id)
values
  ('test_frame_a', 'Test Frame A', 'purchase', 'test_pack_01'),
  ('test_frame_b', 'Test Frame B', 'purchase', 'test_pack_01')
on conflict (id) do nothing;

-- product_id and revenuecat_product_id deliberately differ, so a call matching on
-- either column proves the OR, not a coincidence of the two being equal.
insert into public.frames
  (id, label, unlock_kind, product_id, revenuecat_product_id)
values
  ('test_frame_rc', 'Test Frame RC', 'purchase', 'test_pack_rc_store', 'test_pack_rc_internal')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 'grant-purchase-a@test.piqa');

-- Refused-role check, from the refused side (a previous fix round added coverage
-- for the allowed service_role side below; this is the non-service_role side).
-- Must run before "set role service_role" further down, while the session role is
-- still the test runner's own (non-service_role) role. EXECUTE on grant_purchase is
-- revoked from every role but service_role, so a non-service_role caller is refused
-- at the grant level (permission denied) before ever reaching the function body's
-- own current_setting('role') check/'forbidden' exception — both layers agree.
set role authenticated;
select throws_ok(
  $$ select public.grant_purchase('evt-refused', '20000000-0000-0000-0000-000000000001', 'test_pack_01', '{}'::jsonb) $$,
  '42501',
  'permission denied for function grant_purchase',
  'grant_purchase refuses a caller that is not service_role'
);
reset role;

set role service_role;

select is(
  (public.grant_purchase('evt-unknown', '20000000-0000-0000-0000-000000000001', 'no_such_product', '{}'::jsonb) ->> 'ok')::boolean,
  false,
  'grant_purchase refuses an unrecognized product_id'
);

select is(
  public.grant_purchase('evt-unknown-user', '30000000-0000-0000-0000-000000000099', 'test_pack_01', '{}'::jsonb),
  jsonb_build_object('ok', false, 'reason', 'unknown_user'),
  'grant_purchase refuses a p_user with no matching profiles row instead of raising'
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

select public.grant_purchase('evt-rc', '20000000-0000-0000-0000-000000000001', 'test_pack_rc_internal', '{}'::jsonb);

select is(
  (select count(*)::int from public.user_frames
     where user_id = '20000000-0000-0000-0000-000000000001'
       and frame_id = 'test_frame_rc'),
  1,
  'grant_purchase matches on revenuecat_product_id (RevenueCat''s internal id), not just product_id'
);

select * from finish();
rollback;
