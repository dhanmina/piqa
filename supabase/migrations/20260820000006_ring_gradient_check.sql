-- Final-review fix: ring_gradient is admin-managed jsonb with no shape
-- guarantee at the DB level. The client's string[] type is unenforced --
-- a non-array value would crash FramedPhoto/FramedAvatar's .map() call, and
-- a 1-element array makes the gradient Stop offset (i / (length - 1))
-- evaluate to NaN. Every legitimate use is either null (flat ring) or a
-- 2-to-4 stop gradient (see the frame tiers catalog migration) -- enforce
-- that shape here so a bad admin edit fails at write time, not render time.
alter table public.frames add constraint frames_ring_gradient_shape
  check (
    ring_gradient is null
    or (
      jsonb_typeof(ring_gradient) = 'array'
      and jsonb_array_length(ring_gradient) >= 2
    )
  );
