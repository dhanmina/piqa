-- The Golden Hour / Blue Hour pack (Phase 3a's original purchasable cosmetic)
-- is retired now that the 3-tier catalog replaces it as the current lineup.
-- Not a hard delete: existing owners keep the frame and can still equip it
-- (frameOwned() in lib/services/frames.ts checks user_frames ownership
-- regardless of unlock_kind), this just stops it from being SOLD going
-- forward -- framePurchasable() requires unlock_kind = 'purchase', so
-- flipping to 'manual' removes it from FramePicker's buyable rows without
-- touching user_frames, profiles.equipped_frame, or any FK.
update public.frames
set unlock_kind = 'manual', unlock_label = 'No longer available'
where id in ('goldenhour', 'bluehour');
