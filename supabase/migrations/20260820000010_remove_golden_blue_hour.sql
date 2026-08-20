-- Golden Hour / Blue Hour pack was already retired from sale (see
-- 20260820000008_retire_pack_frames.sql, unlock_kind='manual') so no new
-- purchase could reach it. Now removing it entirely, including from
-- whoever already owns it -- a deliberate call, not an accident:
-- purchase_events (the RevenueCat ledger) stays untouched, it's an
-- append-only history and isn't FK-linked to frames.
delete from public.user_frames where frame_id in ('goldenhour', 'bluehour');
delete from public.frames where id in ('goldenhour', 'bluehour');
