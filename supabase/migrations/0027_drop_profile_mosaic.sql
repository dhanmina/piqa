-- Profile's photo mosaic was cut: same photos, no calendar/streak context,
-- duplicating what Timeline already does better. Timeline is now the one
-- place to browse captures; nothing calls get_profile_mosaic() any more.
drop function if exists public.get_profile_mosaic();
