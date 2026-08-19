-- Sanity check on the frame tiers catalog migration: every new row exists with
-- the right tier-defining fields populated (or absent). Not testing rendering
-- (that's client code, verified on-device in Task 6) -- just that the data
-- this whole feature is built on landed correctly.
begin;
select plan(4);

select is(
  (select count(*)::int from public.frames
     where id in ('focus','flash','grain') and unlock_kind = 'purchase'
       and ring_gradient is null and shimmer = false and suffix_text is null),
  3,
  'Tier 1 frames: purchase-unlocked, flat ring, no suffix'
);

select is(
  (select count(*)::int from public.frames
     where id in ('bokeh','silhouette','reflection') and unlock_kind = 'purchase'
       and jsonb_array_length(ring_gradient) = 2 and shimmer = false and suffix_text is not null),
  3,
  'Tier 2 frames: purchase-unlocked, 2-stop gradient, shimmer off, has suffix'
);

select is(
  (select count(*)::int from public.frames
     where id in ('doubleexposure','aurora') and unlock_kind = 'purchase'
       and jsonb_array_length(ring_gradient) = 2 and shimmer = true),
  2,
  'Tier 3 (2-stop) frames: gradient present, shimmer on'
);

select is(
  (select jsonb_array_length(ring_gradient) from public.frames where id = 'seasons'),
  4,
  'Seasons is the one 4-stop gradient frame'
);

select * from finish();
rollback;
