-- Phase 4 · Step 9 (part) — device push token for FCM drop/reveal notifications.
-- The Expo push token registered on-device; server-side fan-out (drop_prompt →
-- Expo Push API) is launch-prep infra. Own-row RLS already governs updates.
alter table public.profiles add column if not exists push_token text;
