-- Fix: the 0B rename migration (20260721000002) regenerated get_gallery from a
-- local dump whose get_gallery had LOST the decorate_photos() wrapper, so it
-- shipped `'photos', payload -> 'photos'` to prod again — stripping day_number /
-- frame_id / status, and the frame counter rendered the literal "undefined".
--
-- This restores the known-good get_gallery (from 20260720151748) with the
-- decorate_photos(filter_public_photos(...)) call, updated for the renamed tables
-- (prompt_drops -> subject_drops, prompts -> subjects; columns unchanged).
create or replace function public.get_gallery(p_drop uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  g record;
  payload jsonb;
  cur_id uuid;
  is_seed boolean := false;
  past jsonb;
  nxt timestamptz;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into prof from public.profiles where id = uid;

  if p_drop is not null then
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.subject_drops pd on pd.id = ga.drop_id
    where ga.drop_id = p_drop and pd.region = prof.region;
    if g.drop_id is not null then payload := g.payload; end if;
  else
    -- latest materialized gallery for my region
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.subject_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
    order by pd.drop_date desc
    limit 1;
    if g.drop_id is not null then payload := g.payload; end if;
  end if;

  -- Seed fallback: no materialized gallery yet — show the most recent
  -- REVEALED drop's submissions so the tab is never blank. Never pick
  -- an unrevealed drop: that would leak the Photo of the Day crown
  -- before voting ends.
  if payload is null then
    select pd.id, pd.drop_date,
           case when pd.drops_at <= now() then pr.text else null end as prompt
      into g
    from public.subject_drops pd
    join public.subjects pr on pr.id = pd.prompt_id
    where pd.region = prof.region
      and pd.status = 'revealed'
      and exists (select 1 from public.submissions s where s.drop_id = pd.id and s.thumb_path is not null)
    order by pd.drop_date desc
    limit 1;

    if g.id is null then
      return jsonb_build_object('drop', null, 'photos', '[]'::jsonb, 'is_seed', false,
                                'past', '[]'::jsonb, 'next_drop_at', null);
    end if;

    is_seed := true;
    payload := jsonb_build_object(
      'drop_id', g.id,
      'drop_date', g.drop_date,
      'prompt', g.prompt,
      'photos', coalesce((
        select jsonb_agg(obj order by rnk)
        from (
          select jsonb_build_object(
                   'id', s.id, 'thumb_path', s.thumb_path, 'image_path', s.image_path,
                   'user_id', s.user_id, 'shooter', pr.username,
                   'hearts', s.vote_count + s.reaction_count,
                   'is_potd', s.is_potd,
                   'bt_score', s.bt_score, 'captured_at', s.captured_at
                 ) as obj,
                 row_number() over (order by s.bt_score desc nulls last, s.vote_count desc, s.id) as rnk
          from public.submissions s
          join public.profiles pr on pr.id = s.user_id
          where s.drop_id = g.id and s.thumb_path is not null
          order by s.bt_score desc nulls last, s.vote_count desc, s.id
          limit 24
        ) q
      ), '[]'::jsonb)
    );
  end if;

  -- Past galleries (immutable back-issues) for date paging — summaries only.
  cur_id := (payload ->> 'drop_id')::uuid;
  select coalesce(jsonb_agg(
           jsonb_build_object('drop_id', t.drop_id, 'drop_date', t.drop_date, 'prompt', t.prompt)
           order by t.drop_date desc
         ), '[]'::jsonb)
    into past
  from (
    select ga.drop_id, pd.drop_date, (ga.payload ->> 'prompt') as prompt
    from public.galleries ga
    join public.subject_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
      and ga.drop_id <> cur_id
    order by pd.drop_date desc
    limit 30
  ) t;

  -- Live "what's happening now" teaser.
  select pd.drops_at into nxt
  from public.subject_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  return jsonb_build_object(
    'drop', jsonb_build_object(
      'id', payload ->> 'drop_id',
      'prompt', payload ->> 'prompt',
      'drop_date', payload ->> 'drop_date'
    ),
    'photos', public.decorate_photos(public.filter_public_photos(payload -> 'photos', uid)),
    'is_seed', is_seed,
    'past', past,
    'next_drop_at', nxt
  );
end;
$$;

revoke execute on function public.get_gallery(uuid) from public, anon;
grant  execute on function public.get_gallery(uuid) to authenticated;
