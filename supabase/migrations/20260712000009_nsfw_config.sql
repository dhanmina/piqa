-- Phase 4 · Step 8c — NSFW gate threshold (spec §12). Tunable without deploy.
-- The on-device classifier blocks a capture whose NSFW probability is >= this.
insert into public.config (key, value) values
  ('nsfw_threshold', '0.7')
on conflict (key) do nothing;
