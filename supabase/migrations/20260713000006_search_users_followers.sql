create or replace function public.search_users(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  safe_q text;
  res jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if length(trim(p_query)) < 2 then
    return '[]'::jsonb;
  end if;

  safe_q := '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%';

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', p.id,
             'username', p.username,
             'avatar_url', p.avatar_url,
             'is_following', exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.id),
             'followers', coalesce((select count(*) from public.follows f where f.followee_id = p.id), 0),
             'hearts', coalesce((select sum(s.vote_count + s.reaction_count) from public.submissions s where s.user_id = p.id), 0)
           )
         ), '[]'::jsonb)
    into res
  from (
    select id, username, avatar_url
    from public.profiles
    where username ilike safe_q
    limit 20
  ) p;

  return res;
end;
$$;
