-- Frame tiers catalog (extends Phase 3a's purchase pipeline). Additive: 2 new
-- columns on frames, 9 new purchase-unlock rows. No changes to grant_purchase()
-- or the purchase_events table — a single-frame product is already the N=1 case
-- of the pack-grant loop Phase 3a shipped.
--
-- ring_gradient is a nullable ordered array of hex strings: null = flat ring
-- (existing tier-1-style rendering via ring_color, unchanged), 2 entries = the
-- two-tone gradient every Tier 2/3 frame uses, 4 entries = Seasons' 4-stop
-- seasonal cycle. shimmer=true marks the 3 Tier 3 frames that get the animated
-- treatment (rotating gradient sweep + glow + shimmer) on top of the same
-- 2-tone gradient every Tier 2 frame already has.

alter table public.frames add column if not exists shimmer boolean not null default false;
alter table public.frames add column if not exists ring_gradient jsonb;

-- ---------------------------------------------------------------------------
-- Tier 1 -- Singles ($0.99). Flat ring (ring_gradient null), no suffix.
-- ---------------------------------------------------------------------------
insert into public.frames
  (id, label, hairline_color, hairline_opacity, counter_color, marker_shape,
   ring_color, unlock_kind, unlock_label, product_id)
values
  ('focus', 'Focus', '#3D8B8B', 0.5, '#F2EDE4', 'focus',
   '#3D8B8B', 'purchase', '$0.99', 'piqa_frame_focus'),
  ('flash', 'Flash', '#E0806B', 0.5, '#F2EDE4', 'flash',
   '#E0806B', 'purchase', '$0.99', 'piqa_frame_flash'),
  ('grain', 'Grain', '#8A7A6B', 0.5, '#F2EDE4', 'grain',
   '#8A7A6B', 'purchase', '$0.99', 'piqa_frame_grain')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tier 2 -- Elaborate ($1.99-2.99, seeded at $1.99). Two-tone gradient ring,
-- custom marker, suffix text.
-- ---------------------------------------------------------------------------
insert into public.frames
  (id, label, hairline_color, hairline_opacity, counter_color, marker_shape,
   suffix_text, suffix_color, ring_color, ring_gradient, unlock_kind, unlock_label, product_id)
values
  ('bokeh', 'Bokeh', '#A6708F', 0.6, '#F2EDE4', 'bokeh',
   '· BOKEH', '#D9A8C0', '#A6708F', '["#A6708F","#D9A8C0"]'::jsonb,
   'purchase', '$1.99', 'piqa_frame_bokeh'),
  ('silhouette', 'Silhouette', '#3A4A6B', 0.6, '#F2EDE4', 'silhouette',
   '· SILHOUETTE', '#7488B0', '#3A4A6B', '["#3A4A6B","#7488B0"]'::jsonb,
   'purchase', '$1.99', 'piqa_frame_silhouette'),
  ('reflection', 'Reflection', '#7B8FA6', 0.6, '#F2EDE4', 'reflection',
   '· REFLECTION', '#B4C4D6', '#7B8FA6', '["#7B8FA6","#B4C4D6"]'::jsonb,
   'purchase', '$1.99', 'piqa_frame_reflection')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tier 3 -- Animated ($4.99+, seeded at $4.99). Same gradient-ring-plus-suffix
-- foundation as Tier 2, shimmer=true layers the animated treatment on top.
-- Seasons is the only 4-stop gradient -- inherently 4-phase, not an
-- inconsistency (see spec §2.4).
-- ---------------------------------------------------------------------------
insert into public.frames
  (id, label, hairline_color, hairline_opacity, counter_color, marker_shape,
   suffix_text, suffix_color, ring_color, ring_gradient, shimmer, unlock_kind, unlock_label, product_id)
values
  ('doubleexposure', 'Double Exposure', '#8B4B7A', 0.7, '#F2EDE4', 'doubleexposure',
   '· DOUBLE EXPOSURE', '#D689B8', '#8B4B7A', '["#8B4B7A","#D689B8"]'::jsonb, true,
   'purchase', '$4.99', 'piqa_frame_doubleexposure'),
  ('aurora', 'Aurora', '#3D8A6B', 0.7, '#F2EDE4', 'aurora',
   '· AURORA', '#9C6BC7', '#3D8A6B', '["#3D8A6B","#9C6BC7"]'::jsonb, true,
   'purchase', '$4.99', 'piqa_frame_aurora'),
  ('seasons', 'Seasons', '#7FBF8F', 0.7, '#F2EDE4', 'seasons',
   '· SEASONS', '#E8F0F5', '#7FBF8F',
   '["#7FBF8F","#4FC1C7","#C7703D","#E8F0F5"]'::jsonb, true,
   'purchase', '$4.99', 'piqa_frame_seasons')
on conflict (id) do nothing;
