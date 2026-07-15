-- Markers are named shapes, not uploaded SVGs. Arbitrary SVG markers did not render
-- reliably on device, so the app now draws a small set of literal native glyphs
-- (FramedPhoto's MarkerGlyph) and a frame picks one by name. Adding a frame is still
-- pure data (pick a shape + colors); only a brand-new shape needs an app release.
--
-- marker_svg (added in 20260715000002) is superseded and now unused by rendering;
-- left in place to avoid a destructive drop. marker_shape is the field that matters.

alter table public.frames add column if not exists marker_shape text;

-- Built-in shapes the app knows how to draw. null → the default triangle.
update public.frames set marker_shape = 'crown' where id = 'crown';
update public.frames set marker_shape = 'heart' where id = 'valentines';
