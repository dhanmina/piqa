-- Start a scheduled drop immediately: set drops_at to now and recalculate the
-- close windows (submit ≈ +5 h, voting ≈ +13 h, matching the hardcoded cadence
-- in drop_prompt). Only allowed while the drop is still 'scheduled'.

create or replace function public.admin_start_drop(p_drop uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  before jsonb;
  new_submit timestamptz;
  new_voting timestamptz;
begin
  if not public.is_admin(uid) then
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
           'drops_at', drops_at,
           'submit_closes_at', submit_closes_at,
           'voting_closes_at', voting_closes_at,
           'status', status
         )
  into before
  from public.prompt_drops
  where id = p_drop;

  if before is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if before->>'status' <> 'scheduled' then
    return jsonb_build_object('ok', false, 'reason', 'not_scheduled');
  end if;

  new_submit := now() + interval '5 hours';
  new_voting := now() + interval '13 hours';

  update public.prompt_drops
     set drops_at         = now(),
         submit_closes_at = new_submit,
         voting_closes_at = new_voting,
         status           = 'live'
   where id = p_drop;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'drop.start', 'prompt_drop', p_drop::text, before,
          jsonb_build_object('drops_at', now(), 'submit_closes_at', new_submit, 'voting_closes_at', new_voting, 'status', 'live'));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_start_drop(uuid) from public, anon;
grant  execute on function public.admin_start_drop(uuid) to authenticated;
