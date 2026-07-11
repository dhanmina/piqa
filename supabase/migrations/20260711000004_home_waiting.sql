-- Phase 2 addendum — populated waiting/anticipation states (no blank screens).
-- get_home_state() gains next-drop countdown + yesterday's PotD; new
-- get_latest_gallery() feeds the Gallery tab's non-blank zero state.

create or replace function public.get_home_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  cur record;
  nxt timestamptz;
  s record;
  potd record;
  st public.streaks%rowtype;
  drop_json jsonb := null;
  sub_json jsonb := null;
  potd_json jsonb := null;
  streak_json jsonb := null;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  -- Active cycle drop for my region: from drop time through voting close (8am).
  -- Covers both the submit window and the overnight voting tail.
  select pd.id, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at,
         p.text as prompt, p.category as category
    into cur
  from public.prompt_drops pd
  join public.prompts p on p.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  -- Next scheduled drop = the countdown target. Prompt text intentionally
  -- omitted so an upcoming Shot never leaks before it drops.
  select pd.drops_at into nxt
  from public.prompt_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  if cur.id is not null then
    drop_json := jsonb_build_object(
      'id', cur.id,
      'prompt', cur.prompt,
      'category', cur.category,
      'drops_at', cur.drops_at,
      'submit_closes_at', cur.submit_closes_at,
      'voting_closes_at', cur.voting_closes_at,
      'is_live', (now() < cur.submit_closes_at)
    );

    select sub.id, sub.captured_at, sub.image_path, sub.thumb_path,
           sub.vote_count, sub.reaction_count, sub.quick_draw, sub.in_gallery, sub.is_potd
      into s
    from public.submissions sub
    where sub.drop_id = cur.id and sub.user_id = uid;

    if s.id is not null then
      sub_json := jsonb_build_object(
        'id', s.id,
        'captured_at', s.captured_at,
        'image_path', s.image_path,
        'thumb_path', s.thumb_path,
        'vote_count', s.vote_count,
        'reaction_count', s.reaction_count,
        'quick_draw', s.quick_draw,
        'in_gallery', s.in_gallery,
        'is_potd', s.is_potd
      );
    end if;
  end if;

  -- Most recent Photo of the Day from a revealed gallery in my region.
  select s2.id, s2.drop_id, s2.thumb_path,
         (s2.vote_count + s2.reaction_count) as hearts,
         pr.username as shooter
    into potd
  from public.submissions s2
  join public.prompt_drops pd2 on pd2.id = s2.drop_id
  join public.profiles pr on pr.id = s2.user_id
  where pd2.region = prof.region and s2.is_potd = true
  order by pd2.drop_date desc
  limit 1;

  if potd.id is not null then
    potd_json := jsonb_build_object(
      'submission_id', potd.id,
      'drop_id', potd.drop_id,
      'thumb_path', potd.thumb_path,
      'hearts', potd.hearts,
      'shooter', potd.shooter
    );
  end if;

  select * into st from public.streaks where user_id = uid;
  if st.user_id is not null then
    streak_json := jsonb_build_object(
      'current_weeks', st.current_weeks,
      'days_this_week', st.days_this_week,
      'shields', st.shields
    );
  end if;

  return jsonb_build_object(
    'drop', drop_json,
    'next_drop_at', nxt,
    'submission', sub_json,
    'yesterday_potd', potd_json,
    'streak', streak_json
  );
end;
$$;

revoke execute on function public.get_home_state() from public, anon;
grant execute on function public.get_home_state() to authenticated;


-- Latest revealed gallery for my region — powers the Gallery tab's non-blank
-- zero state. Photos carry hearts (votes + reactions), shooter, PotD flag,
-- ordered PotD → BT score → votes. Signed thumb URLs are added client-side.
create or replace function public.get_latest_gallery()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  g record;
  photos jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  select pd.id, pd.drop_date, p.text as prompt
    into g
  from public.prompt_drops pd
  join public.prompts p on p.id = pd.prompt_id
  where pd.region = prof.region
    and exists (select 1 from public.submissions s where s.drop_id = pd.id and s.in_gallery)
  order by pd.drop_date desc
  limit 1;

  if g.id is null then
    return jsonb_build_object('drop', null, 'photos', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', s.id,
             'thumb_path', s.thumb_path,
             'hearts', s.vote_count + s.reaction_count,
             'shooter', pr.username,
             'is_potd', s.is_potd
           )
           order by s.is_potd desc, s.bt_score desc nulls last, s.vote_count desc
         ), '[]'::jsonb)
    into photos
  from public.submissions s
  join public.profiles pr on pr.id = s.user_id
  where s.drop_id = g.id and s.in_gallery;

  return jsonb_build_object(
    'drop', jsonb_build_object('id', g.id, 'prompt', g.prompt, 'drop_date', g.drop_date),
    'photos', photos
  );
end;
$$;

revoke execute on function public.get_latest_gallery() from public, anon;
grant execute on function public.get_latest_gallery() to authenticated;
