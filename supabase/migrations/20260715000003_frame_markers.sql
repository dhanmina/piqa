-- Marker legibility — tighten the built-in marker glyphs so they fill the marker
-- slot instead of floating small inside a padded viewBox. The app also enlarged
-- the slot (FramedPhoto markerSlot); this makes the glyph fill it, so the crown
-- reads as a crown at a 3-column thumbnail.
--
-- Only the viewBox changes (the glyph paths are identical) — a tight box means the
-- glyph is scaled up to fill the slot rather than sitting in padding.

update public.frames set
  marker_svg = '<svg viewBox="-13 -9 26 21" xmlns="http://www.w3.org/2000/svg"><path d="M-12 6 L-12 -4 L-6 1 L0 -8 L6 1 L12 -4 L12 6 Z" fill="#E3B341"/><rect x="-12" y="8" width="24" height="3" fill="#E3B341"/></svg>'
where id = 'crown';

update public.frames set
  marker_svg = '<svg viewBox="-11 -13 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M0 8 C -10 -2 -8 -12 -3 -9 C -1 -8 0 -6 0 -5 C 0 -6 1 -8 3 -9 C 8 -12 10 -2 0 8 Z" fill="#E6453C"/></svg>'
where id = 'valentines';
