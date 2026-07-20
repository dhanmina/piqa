-- Admin recent submissions for the dashboard strip. Returns the 10 most
-- recent submissions with profile info, drop date, signed-ready thumb path.
create or replace function public.admin_recent_submissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'thumb_path', s.thumb_path,
        'shooter', pr.username,
        'shooter_id', s.user_id,
        'vote_count', s.vote_count,
        'reaction_count', s.reaction_count,
        'drop_date', pd.drop_date,
        'prompt', pd.prompt,
        'captured_at', s.captured_at
      )
      order by s.created_at desc
    )
    from public.submissions s
    join public.profiles pr on pr.id = s.user_id
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.thumb_path is not null
    limit 10
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_recent_submissions() from public, anon;
grant  execute on function public.admin_recent_submissions() to authenticated;
