-- Profile frame ring. `profiles.equipped_frame` is now the PROFILE frame (it no longer
-- touches photos — see 20260718000002). The equipped frame tints the avatar ring, so an
-- earned frame (esp. the crown) is a persistent, visible flex, not just a photo skin.
--
-- ring_color is that avatar-ring accent. null → no frame ring (the level ring shows).
-- The client also falls back to suffix_color, so these frames already ring correctly
-- even before this populate runs; the column just makes it explicit and overridable.
alter table public.frames
  add column if not exists ring_color text;

update public.frames set ring_color = '#E3B341' where id = 'crown';       -- crown gold (PotD only)
update public.frames set ring_color = '#E6453C' where id = 'valentines';  -- heart red
-- 'default' stays null → no frame ring, so the level ring is the base look.
