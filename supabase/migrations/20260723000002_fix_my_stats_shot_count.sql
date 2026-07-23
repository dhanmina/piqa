-- Fix: get_my_stats() only counted submissions (daily shots), missing free_shots.
-- Now counts both tables to match the archive's total.
create or replace function public.get_my_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'shots',       (select count(*) from public.submissions where user_id = auth.uid())
                   + (select count(*) from public.free_shots where user_id = auth.uid()),
    'galleries',   (select count(*) from public.submissions where user_id = auth.uid() and in_gallery),
    'potd',        (select count(*) from public.submissions where user_id = auth.uid() and is_potd),
    'best_rank',   (select min(gallery_rank) from public.submissions
                     where user_id = auth.uid() and in_gallery and gallery_rank is not null),
    'quick_draws', (select count(*) from public.submissions where user_id = auth.uid() and quick_draw)
  );
$$;
