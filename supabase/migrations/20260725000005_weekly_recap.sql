-- Weekly recap: best shot + stats + streak for the last 7 days.
-- Called client-side via supabase.rpc('get_weekly_recap', { p_user_id: uid }).
-- No new tables — reads from submissions, reactions, subject_drops, streaks.
-- The "best shot" is the in_gallery submission with the most hearts; falls back
-- to most-recent if nothing made the gallery.
create or replace function public.get_weekly_recap(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with week_bounds as (
    select
      (current_date - interval '6 days')::date as start_date,
      current_date as end_date
  ),
  week_shots as (
    select s.id, sd.day_number, s.is_potd, s.in_gallery, s.captured_at, s.vote_count,
           s.image_path, s.thumb_path,
           sd.drop_date,
           coalesce((
             select count(*) from public.reactions r
             where r.submission_id = s.id and r.emoji = 'heart'
           ), 0) as hearts
    from public.submissions s
    join public.subject_drops sd on sd.id = s.drop_id
    join week_bounds wb on sd.drop_date between wb.start_date and wb.end_date
    where s.user_id = p_user_id
      and s.captured_at is not null
      and s.quarantined = false
      and s.content_label is null
  ),
  best_shot as (
    select id, day_number, is_potd, in_gallery, hearts, image_path, thumb_path
    from week_shots
    order by in_gallery desc, hearts desc, is_potd desc, captured_at desc
    limit 1
  ),
  week_reactions as (
    select coalesce(sum(ws.hearts), 0) as total_hearts,
           coalesce(sum(ws.vote_count), 0) as total_picks
    from week_shots ws
  )
  select jsonb_build_object(
    'start_date',   (select start_date from week_bounds),
    'end_date',     (select end_date from week_bounds),
    'shot_count',   (select count(*) from week_shots),
    'gallery_count',(select count(*) from week_shots where in_gallery),
    'heart_count',  (select total_hearts from week_reactions),
    'pick_count',   (select total_picks from week_reactions),
    'potd_count',   (select count(*) from week_shots where is_potd),
    'best_shot',    (select to_jsonb(bs) from best_shot bs),
    'streak_days',  (select coalesce(st.current_weeks, 0) from public.streaks st where st.user_id = p_user_id),
    'streak_alive', (select coalesce(st.is_alive, false) from public.streaks st where st.user_id = p_user_id)
  );
$$;

revoke execute on function public.get_weekly_recap(uuid) from public, anon;
grant  execute on function public.get_weekly_recap(uuid) to authenticated;
