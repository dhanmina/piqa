-- "Your journey" (learning loop · spec §7 "your best finish"): private self-stats
-- derived from the user's own submissions — best finish, shots, galleries, PotD,
-- quick-draws. Own data only (auth.uid()); never a comparison to others (Law 3).
create or replace function public.get_my_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'shots',       (select count(*) from public.submissions where user_id = auth.uid()),
    'galleries',   (select count(*) from public.submissions where user_id = auth.uid() and in_gallery),
    'potd',        (select count(*) from public.submissions where user_id = auth.uid() and is_potd),
    'best_rank',   (select min(gallery_rank) from public.submissions
                     where user_id = auth.uid() and in_gallery and gallery_rank is not null),
    'quick_draws', (select count(*) from public.submissions where user_id = auth.uid() and quick_draw)
  );
$$;
revoke execute on function public.get_my_stats() from public, anon;
grant  execute on function public.get_my_stats() to authenticated;
