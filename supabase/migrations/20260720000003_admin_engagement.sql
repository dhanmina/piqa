-- Admin engagement metrics — deeper analytics for the dashboard.
-- Returns daily active user counts (unique submitters + voters), participation
-- rate, and aggregate engagement stats. Admin-gated, security-definer.

create or replace function public.admin_engagement()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  daily jsonb;
  totals jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  -- Last 14 drop days: unique submitters, unique voters, participation rate
  daily := coalesce((
    select jsonb_agg(row order by (row->>'date'))
    from (
      select jsonb_build_object(
               'date', pd.drop_date,
               'submissions', coalesce(sub_stats.cnt, 0),
               'voters', coalesce(vote_stats.cnt, 0),
               'unique_submitters', coalesce(sub_stats.users, 0),
               'unique_voters', coalesce(vote_stats.users, 0),
               'participation_rate', case
                 when coalesce(sub_stats.users, 0) = 0 then 0
                 else round(coalesce(vote_stats.users, 0)::numeric / sub_stats.users * 100)
               end
             ) as row
      from public.prompt_drops pd
      left join lateral (
        select count(*) as cnt, count(distinct s.user_id) as users
        from public.submissions s
        where s.drop_id = pd.id and s.thumb_path is not null
      ) sub_stats on true
      left join lateral (
        select count(*) as cnt, count(distinct v.voter_id) as users
        from public.votes v
        where v.drop_id = pd.id
      ) vote_stats on true
      group by pd.drop_date, sub_stats.cnt, sub_stats.users, vote_stats.cnt, vote_stats.users
      order by pd.drop_date desc
      limit 14
    ) q
  ), '[]'::jsonb);

  -- Aggregate engagement totals
  totals := jsonb_build_object(
    'total_premium', (select count(*) from public.profiles where is_premium),
    'total_admins', (select count(*) from public.profiles where is_admin),
    'active_streaks', (select count(*) from public.streaks where is_alive),
    'avg_streak_weeks', coalesce((
      select round(avg(current_weeks)::numeric, 1)
      from public.streaks where is_alive and current_weeks > 0
    ), 0),
    'max_streak_weeks', coalesce((
      select max(current_weeks) from public.streaks
    ), 0),
    'total_reactions', (select count(*) from public.reactions)
  );

  return jsonb_build_object('daily', daily, 'totals', totals);
end;
$$;

revoke execute on function public.admin_engagement() from public, anon;
grant  execute on function public.admin_engagement() to authenticated;
