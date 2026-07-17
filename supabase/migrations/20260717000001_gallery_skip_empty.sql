-- World tab: skip empty galleries when choosing "the latest".
--
-- close_day materializes an EMPTY gallery (payload photos = []) and marks the
-- drop `revealed` whenever a day closes with zero submissions (k = 0, see
-- 20260716000004_potd_requires_votes). get_gallery's "latest" branch then picked
-- the newest gallery by drop_date REGARDLESS of whether it had photos — so one
-- empty day (e.g. an advanced-but-unshot day from the dev time machine) became
-- the World cover and hid every real gallery behind it, leaving World stuck on
-- the "first galleries are rolling in" empty state while Following (which reads
-- in_gallery photos from the trailing 7 days) still worked.
--
-- Fix: the latest-gallery selection and the past-issues list both require a
-- non-empty photos payload. An empty day now gracefully rolls World back to the
-- most recent gallery that actually has photos, and never appears as a tappable
-- back-issue. (A specific back-issue opened by id is unchanged — it's only
-- reachable via the past list, which no longer surfaces empty galleries.)
create or replace function public.get_gallery(p_drop uuid default null)
returns jsonb
language plpgsql
stable
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
    join public.prompt_drops pd on pd.id = ga.drop_id
    where ga.drop_id = p_drop and pd.region = prof.region;
    if g.drop_id is not null then payload := g.payload; end if;
  else
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.prompt_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
      and jsonb_array_length(coalesce(ga.payload -> 'photos', '[]'::jsonb)) > 0
    order by pd.drop_date desc
    limit 1;
    if g.drop_id is not null then payload := g.payload; end if;
  end if;

  if payload is null then
    select pd.id, pd.drop_date,
           case when pd.drops_at <= now() then pr.text else null end as prompt
      into g
    from public.prompt_drops pd
    join public.prompts pr on pr.id = pd.prompt_id
    where pd.region = prof.region
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
                   'is_potd', row_number() over (order by s.vote_count desc, s.id) = 1,
                   'bt_score', null, 'captured_at', s.captured_at
                 ) as obj,
                 row_number() over (order by s.vote_count desc, s.id) as rnk
          from public.submissions s
          join public.profiles pr on pr.id = s.user_id
          where s.drop_id = g.id and s.thumb_path is not null
          order by s.vote_count desc, s.id
          limit 24
        ) q
      ), '[]'::jsonb)
    );
  end if;

  cur_id := (payload ->> 'drop_id')::uuid;
  select coalesce(jsonb_agg(
           jsonb_build_object('drop_id', t.drop_id, 'drop_date', t.drop_date, 'prompt', t.prompt)
           order by t.drop_date desc
         ), '[]'::jsonb)
    into past
  from (
    select ga.drop_id, pd.drop_date, (ga.payload ->> 'prompt') as prompt
    from public.galleries ga
    join public.prompt_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
      and ga.drop_id <> cur_id
      and jsonb_array_length(coalesce(ga.payload -> 'photos', '[]'::jsonb)) > 0
    order by pd.drop_date desc
    limit 30
  ) t;

  select pd.drops_at into nxt
  from public.prompt_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  return jsonb_build_object(
    'drop', jsonb_build_object(
      'id', payload ->> 'drop_id',
      'prompt', payload ->> 'prompt',
      'drop_date', payload ->> 'drop_date',
      'day_number', (select day_number from public.prompt_drops where id = cur_id)
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
