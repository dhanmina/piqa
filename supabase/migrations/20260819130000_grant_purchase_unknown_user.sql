-- Final-review fix: grant_purchase() let an invalid/unresolvable p_user (RevenueCat
-- can send non-UUID app_user_id values like '$RCAnonymousID:...', or a UUID for an
-- account that's since been deleted) fall through to the purchase_events insert,
-- where the profiles FK raised an exception. That made revenuecat-webhook 500 and
-- RevenueCat retry forever on something retrying can never fix. Now checked early
-- (after the role guard and the event-id dedupe, before the frames lookup) and
-- reported the same clean way 'unknown_product' already is: {ok:false, reason:...}.

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

  insert into public.purchase_events (revenuecat_event_id, user_id, product_id, raw_event)
  values (eid, p_user, p_product, p_raw)
  on conflict (revenuecat_event_id) do nothing;

  return jsonb_build_object('ok', true, 'granted', to_jsonb(granted));
end;
$$;

revoke execute on function public.grant_purchase(text, uuid, text, jsonb) from public, anon, authenticated;
grant  execute on function public.grant_purchase(text, uuid, text, jsonb) to service_role;
