-- Final-review fix: frames.unlock_kind's CHECK constraint was widened to allow
-- 'purchase' in 20260819000001_purchase_frames.sql, but admin_save_frame()'s own
-- allow-list (defined in 20260718000011_admin_phase2.sql) was never updated to
-- match, so an admin could never create/edit a 'purchase' frame through the admin
-- dashboard — only via a raw SQL insert like the seed at the bottom of that
-- migration. One-line fix: reproduce admin_save_frame() exactly as it stands today,
-- with 'purchase' added to the unlock_kind allow-list and nothing else changed.

create or replace function public.admin_save_frame(p_id text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); existed boolean;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;
  if p_id is null or char_length(trim(p_id)) = 0 then return jsonb_build_object('ok', false, 'reason', 'bad_id'); end if;
  if coalesce(p_data->>'unlock_kind', 'manual') not in ('default','potd','event','manual','purchase') then
    return jsonb_build_object('ok', false, 'reason', 'bad_unlock_kind');
  end if;
  existed := exists (select 1 from public.frames where id = p_id);

  insert into public.frames as f
    (id, label, ring_color, profile_svg, marker_svg, hairline_color, counter_color,
     suffix_text, suffix_color, unlock_kind, unlock_label, event_start, event_end)
  values (
    p_id,
    coalesce(nullif(p_data->>'label',''), p_id),
    nullif(p_data->>'ring_color',''),
    nullif(p_data->>'profile_svg',''),
    nullif(p_data->>'marker_svg',''),
    coalesce(nullif(p_data->>'hairline_color',''), '#F2EDE4'),
    coalesce(nullif(p_data->>'counter_color',''), '#F2EDE4'),
    nullif(p_data->>'suffix_text',''),
    nullif(p_data->>'suffix_color',''),
    coalesce(nullif(p_data->>'unlock_kind',''), 'manual'),
    nullif(p_data->>'unlock_label',''),
    (nullif(p_data->>'event_start',''))::date,
    (nullif(p_data->>'event_end',''))::date
  )
  on conflict (id) do update set
    label = excluded.label, ring_color = excluded.ring_color, profile_svg = excluded.profile_svg,
    marker_svg = excluded.marker_svg, hairline_color = excluded.hairline_color, counter_color = excluded.counter_color,
    suffix_text = excluded.suffix_text, suffix_color = excluded.suffix_color,
    unlock_kind = excluded.unlock_kind, unlock_label = excluded.unlock_label,
    event_start = excluded.event_start, event_end = excluded.event_end;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (uid, case when existed then 'frame.update' else 'frame.create' end, 'frame', p_id, p_data);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_save_frame(text, jsonb) from public, anon;
grant  execute on function public.admin_save_frame(text, jsonb) to authenticated;
