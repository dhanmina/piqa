-- Admin drop gallery — returns the photo gallery for any drop regardless of
-- region. Tries the materialized galleries table first (revealed drops), then
-- falls back to raw submissions for unrevealed drops (admin preview).
create or replace function public.admin_drop_gallery(p_drop uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  payload jsonb;
  dr record;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  -- Materialized gallery (revealed drops).
  select ga.payload into payload
  from public.galleries ga
  where ga.drop_id = p_drop;

  if payload is not null then
    return jsonb_build_object(
      'drop_id',   payload ->> 'drop_id',
      'drop_date', payload ->> 'drop_date',
      'prompt',    payload ->> 'prompt',
      'photos',    coalesce(payload -> 'photos', '[]'::jsonb)
    );
  end if;

  -- Fallback: build from submissions (unrevealed drop preview).
  select pd.drop_date, pr.text as prompt
    into dr
  from public.prompt_drops pd
  join public.prompts pr on pr.id = pd.prompt_id
  where pd.id = p_drop;

  if dr.drop_date is null then
    return jsonb_build_object('drop_id', null, 'drop_date', null, 'prompt', null, 'photos', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'drop_id',   p_drop,
    'drop_date', dr.drop_date,
    'prompt',    dr.prompt,
    'photos',    coalesce((
      select jsonb_agg(obj order by rnk)
      from (
        select jsonb_build_object(
                 'id',           s.id,
                 'thumb_path',   s.thumb_path,
                 'image_path',   s.image_path,
                 'user_id',      s.user_id,
                 'shooter',      pr.username,
                 'hearts',       s.vote_count + s.reaction_count,
                 'is_potd',      s.is_potd,
                 'bt_score',     s.bt_score,
                 'captured_at',  s.captured_at
               ) as obj,
               row_number() over (order by s.bt_score desc nulls last, s.vote_count desc, s.id) as rnk
        from public.submissions s
        join public.profiles pr on pr.id = s.user_id
        where s.drop_id = p_drop and s.thumb_path is not null
        order by s.bt_score desc nulls last, s.vote_count desc, s.id
        limit 24
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_drop_gallery(uuid) from public, anon;
grant  execute on function public.admin_drop_gallery(uuid) to authenticated;
