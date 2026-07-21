-- Starter Subject library (build-steps 1A · "buffer >= 8 weeks"). 36 shootable,
-- phone-friendly prompts across the six categories. Queued AFTER existing Subjects
-- (seq continues from the current max, used_at null) so nothing already curated is
-- displaced — these fill the buffer behind it. Idempotent (skips by text), so a
-- re-run is safe. Edit / delete / reorder any of these in the in-app admin library.
insert into public.subjects (text, category, seq)
select v.text, v.category, (select coalesce(max(seq), 0) from public.subjects) + v.ord
from (values
  -- object
  ('The oldest thing you own',                         'object',  1),
  ('A tool in the middle of its job',                  'object',  2),
  ('Something that fits in your palm',                 'object',  3),
  ('A pair that belongs together',                     'object',  4),
  ('The most-used thing in your bag',                  'object',  5),
  ('Something worn down by being loved',               'object',  6),
  -- color
  ('One bold color taking over the frame',             'color',   7),
  ('Two colors that should not work together',         'color',   8),
  ('Something green that is not a plant',              'color',   9),
  ('A pop of color in a gray place',                   'color',  10),
  ('The exact color of today',                          'color',  11),
  ('One hue, top to bottom',                            'color',  12),
  -- light
  ('A shadow longer than the thing that made it',      'light',  13),
  ('Light coming through something you can see through','light',  14),
  ('The last light before dark',                        'light',  15),
  ('A reflection you almost walked past',              'light',  16),
  ('Hard light and a sharp edge',                       'light',  17),
  ('The line where light meets shadow',                'light',  18),
  -- pov
  ('Looking straight down',                             'pov',    19),
  ('From the ground, looking up',                       'pov',    20),
  ('Framed through a doorway or window',               'pov',    21),
  ('The view you see every day, reframed',             'pov',    22),
  ('So close it stops being obvious',                  'pov',    23),
  ('A whole scene in one small detail',                'pov',    24),
  -- emotion
  ('What calm looks like right now',                    'emotion',25),
  ('A small, unremarkable moment of joy',              'emotion',26),
  ('Something that feels like waiting',                'emotion',27),
  ('The most comforting corner near you',              'emotion',28),
  ('Quiet, just before it gets loud',                  'emotion',29),
  ('What almost looks like',                            'emotion',30),
  -- absurd
  ('The wrong object in exactly the right place',      'absurd', 31),
  ('Give an everyday thing a face',                    'absurd', 32),
  ('Make something small look enormous',               'absurd', 33),
  ('A tiny drama between two objects',                 'absurd', 34),
  ('The most dramatic possible photo of a snack',      'absurd', 35),
  ('An ordinary thing, treated like treasure',         'absurd', 36)
) as v(text, category, ord)
where not exists (select 1 from public.subjects s where s.text = v.text);
