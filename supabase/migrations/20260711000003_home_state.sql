-- get_home_state() — one screen, one RPC (spec §14).
-- Returns the latest dropped drop for my region (with prompt — safe: only
-- drops whose drops_at has passed are considered, so no prompt leaks),
-- my submission for it, and my streak row.

create or replace function public.get_home_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  d record;
  s record;
  st public.streaks%rowtype;
  drop_json jsonb := null;
  sub_json jsonb := null;
  streak_json jsonb := null;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  select pd.id, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at,
         p.text as prompt_text, p.category as prompt_category
    into d
  from public.prompt_drops pd
  join public.prompts p on p.id = pd.prompt_id
  where pd.region = prof.region
    and pd.drops_at <= now()
  order by pd.drops_at desc
  limit 1;

  if d.id is not null then
    drop_json := jsonb_build_object(
      'id', d.id,
      'prompt', d.prompt_text,
      'category', d.prompt_category,
      'drops_at', d.drops_at,
      'submit_closes_at', d.submit_closes_at,
      'voting_closes_at', d.voting_closes_at,
      'is_live', (now() >= d.drops_at and now() < d.submit_closes_at)
    );

    select sub.id, sub.captured_at, sub.image_path, sub.thumb_path,
           sub.vote_count, sub.quick_draw, sub.in_gallery, sub.is_potd
      into s
    from public.submissions sub
    where sub.drop_id = d.id and sub.user_id = uid;

    if s.id is not null then
      sub_json := jsonb_build_object(
        'id', s.id,
        'captured_at', s.captured_at,
        'image_path', s.image_path,
        'thumb_path', s.thumb_path,
        'vote_count', s.vote_count,
        'quick_draw', s.quick_draw,
        'in_gallery', s.in_gallery,
        'is_potd', s.is_potd
      );
    end if;
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
    'submission', sub_json,
    'streak', streak_json
  );
end;
$$;

revoke execute on function public.get_home_state() from public, anon;
grant execute on function public.get_home_state() to authenticated;
