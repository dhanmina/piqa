-- Show curators the theme they're judging against.
--
-- get_matchup returned the pairs but not the prompt, so the curation UI had no
-- way to display the brief — pairs were judged on pure aesthetics, and an
-- off-theme shot could out-vote an on-theme one. Returning the prompt lets the
-- matchup frame the pick as "which fits THIS better", so the crowd's vote
-- enforces relevance, not just looks. Additive field; older clients ignore it.

create or replace function public.get_matchup()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  d record;
  cap int := public.cfg_int('vote_cap', 50);
  set_size int := public.cfg_int('votes_per_set', 10);
  photo_cap int := public.cfg_int('curator_photo_cap', 2);
  cast_today int;
  remaining int;
  pairs jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  select pd.id, pd.voting_closes_at, pr.text as prompt
    into d
  from public.prompt_drops pd
  join public.prompts pr on pr.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  if d.id is null then
    return jsonb_build_object('drop_id', null, 'prompt', null, 'remaining', 0, 'capped', false, 'pairs', '[]'::jsonb);
  end if;

  select count(*) into cast_today
  from public.votes where voter_id = uid and drop_id = d.id;

  remaining := greatest(cap - cast_today, 0);
  if remaining <= 0 then
    return jsonb_build_object('drop_id', d.id, 'prompt', d.prompt, 'remaining', 0, 'capped', true, 'pairs', '[]'::jsonb);
  end if;

  with seen as (
    -- How many times I've already judged each photo (as winner or loser).
    select photo_id, count(*) as n
    from (
      select winner_id as photo_id from public.votes where voter_id = uid and drop_id = d.id
      union all
      select loser_id  as photo_id from public.votes where voter_id = uid and drop_id = d.id
    ) t
    group by photo_id
  ),
  cand as (
    select s.id, s.thumb_path, s.rating, s.vote_count, coalesce(sn.n, 0) as my_seen
    from public.submissions s
    left join seen sn on sn.photo_id = s.id
    where s.drop_id = d.id
      and s.user_id <> uid
      and s.thumb_path is not null
      and coalesce(sn.n, 0) < photo_cap        -- stop showing me photos I've seen enough
  ),
  pool as (
    select *, row_number() over (order by my_seen asc, vote_count asc, random()) as expo
    from cand                                   -- least-seen-by-me first, for variety
  ),
  banded as (
    select * from pool where expo <= 40
  ),
  ordered as (
    select *, row_number() over (order by rating asc, random()) as rn
    from banded
  ),
  raw_pairs as (
    select a.id as a_id, a.thumb_path as a_thumb,
           b.id as b_id, b.thumb_path as b_thumb
    from ordered a
    join ordered b on b.rn = a.rn + 1 and (a.rn % 2) = 1
  ),
  fresh as (
    select rp.*
    from raw_pairs rp
    where not exists (
      select 1 from public.votes v
      where v.voter_id = uid
        and least(v.winner_id, v.loser_id)    = least(rp.a_id, rp.b_id)
        and greatest(v.winner_id, v.loser_id) = greatest(rp.a_id, rp.b_id)
    )
    order by random()
    limit least(set_size, remaining)
  )
  select coalesce(jsonb_agg(
           -- Randomly assign top/bottom so position is strength-neutral.
           case when random() < 0.5 then
             jsonb_build_object(
               'a', jsonb_build_object('id', a_id, 'thumb_path', a_thumb),
               'b', jsonb_build_object('id', b_id, 'thumb_path', b_thumb)
             )
           else
             jsonb_build_object(
               'a', jsonb_build_object('id', b_id, 'thumb_path', b_thumb),
               'b', jsonb_build_object('id', a_id, 'thumb_path', a_thumb)
             )
           end
         ), '[]'::jsonb)
    into pairs
  from fresh;

  return jsonb_build_object(
    'drop_id', d.id,
    'prompt', d.prompt,
    'remaining', remaining,
    'capped', false,
    'pairs', pairs
  );
end;
$$;

revoke execute on function public.get_matchup() from public, anon;
grant  execute on function public.get_matchup() to authenticated;
