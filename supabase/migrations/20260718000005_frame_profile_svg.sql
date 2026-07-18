-- Profile-frame ART becomes fully admin-managed: the avatar-frame SVG lives in the
-- frames table (profile_svg), rendered on device via react-native-svg's SvgXml. So a
-- brand-new frame DESIGN is a Studio row (id + unlock rule + profile_svg), no app
-- release; clear the column and the frame falls back to a plain ring (ring_color).
--
-- CONTRACT for an uploaded profile_svg (so the avatar lines up and it renders):
--   * self-contained SVG only — inline attributes, no external CSS/fonts/images;
--   * viewBox "-6 -6 76 76", the avatar fills the circle at center (32,32) r28,
--     the ring/ornament are drawn around it.
alter table public.frames
  add column if not exists profile_svg text;

update public.frames set profile_svg =
  '<svg viewBox="-6 -6 76 76" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bandS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6D57A"/><stop offset="0.5" stop-color="#E3B341"/><stop offset="1" stop-color="#A87B1F"/></linearGradient></defs><circle cx="32" cy="32" r="28" fill="none" stroke="url(#bandS)" stroke-width="3"/><circle cx="32" cy="4.5" r="3.4" fill="url(#bandS)"/><circle cx="32" cy="4.5" r="1.9" fill="#FF5A36"/></svg>'
  where id = 'crown';

update public.frames set profile_svg =
  '<svg viewBox="-6 -6 76 76" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="roseBandS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F9D4C6"/><stop offset="0.5" stop-color="#E8997F"/><stop offset="1" stop-color="#A85B42"/></linearGradient></defs><circle cx="32" cy="32" r="28" fill="none" stroke="url(#roseBandS)" stroke-width="3"/><g transform="translate(32 4.8) scale(0.078) translate(-101 -101) rotate(-7 101 101)"><path d="M100 162 C74 138 44 116 42 84 C41 60 56 46 74 46 C85 46 94 52 99 62 C102 50 112 40 127 40 C148 40 162 56 160 80 C157 114 126 138 100 162 Z" fill="#FF5A36" stroke="url(#roseBandS)" stroke-width="8" stroke-linejoin="round"/></g></svg>'
  where id = 'valentines';
-- 'default' stays null → plain ring (ring_color) / the level ring.
