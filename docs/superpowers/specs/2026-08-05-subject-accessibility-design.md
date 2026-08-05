# Subject accessibility redesign — design spec

Date: 2026-08-05
Status: approved by user, pending implementation plan

## Problem

Alpha feedback: some daily Subjects assume access a user doesn't have that
day — an object they don't own, weather/light/location they can't get to.
When it happens, the user doesn't just skip a day — they compare their
situation to what they imagine other Photographers shot and feel excluded
("that's an expensive thing, I don't have it"), and some stop submitting
altogether. This is an inclusivity/access failure, not a motivation failure.

Existing Subject library (`supabase/migrations/20260713000004_launch_prompts.sql`,
`20260721000012_seed_subjects.sql`) is already written fairly abstractly
("The oldest thing you own", "A shadow longer than the thing that made it"),
so the failure isn't universal — it's that a single literal line per Subject
has no guaranteed fallback interpretation, and nothing structural stops a
future or edited Subject from drifting concrete again.

## Non-goals

- Not replacing the daily blind-vote/Bradley-Terry competitive core. Research
  (BeReal's decline, Duolingo's streak mechanics) shows the daily-compete/streak
  loop is the strongest retention lever piqa has; removing it repeats BeReal's
  mistake of a single flat mechanic with nothing added over time.
- Not opening Subject interpretation fully ("shoot anything loosely related").
  GuruShots' top complaint is that voting *feels arbitrary* when off-topic
  photos win unexplained — full openness imports that exact failure. Any
  flexibility must stay bounded and curated by the app, not left to the user's
  imagination.
- Not touching the shield/streak-protect system's mechanics — it already
  auto-covers a missed day silently (`supabase/migrations/20260712000002_streaks_rolling.sql`
  and later `..._streak_days_alive.sql`/`..._streak_no_2_in_a_row.sql`), with
  no shaming and no user action required. Only its tuning (shield count/regen
  rate) and UI copy are in scope, not a new mechanic.

## Design

### 1. Bounded-angle Subjects

Every Subject keeps its single headline line (unchanged — this is what's
shown, what's compared, what's judged). It additionally carries **up to 3
angle-hints**: short alternate framings of the same line, shown to everyone
at drop time (not gated behind failure or a "why this won" postmortem like
the existing technique `hint` column). At least one angle-hint must be
satisfiable with common household objects, any weather, any time of day —
this is an editorial rule for whoever writes/edits Subjects, not a DB
constraint.

Example — headline "The oldest thing you own" doesn't need angles (already
universal). A headline like "Something that reminds you of the beach" would
carry angles: "a color, not just sand and water", "a texture", "a feeling of
being somewhere else" — so a user nowhere near a beach still has a way in.

All angle-hints describe the *same* Subject and the *same* photo pool — this
is presentation, not a parallel track. Voting, ranking, and the gallery are
completely unaware angles exist; a curator blind-comparing two photos has no
idea which angle (if any) either photographer used. This is what keeps it
from becoming GuruShots' "why did that off-topic thing win" complaint: the
angles are curated by piqa, bounded to 3, and still visibly answer the same
headline.

**Schema:** `subjects.angles text[]` (nullable, 0-3 entries), same pattern as
the existing `hint text` column added in `20260721000008_subject_hints.sql`.

**Admin:** subject create/edit form (`/admin-library`) gets up to 3 optional
angle-hint inputs alongside the existing text/category/hint fields, via new
`admin_set_subject_angles(p_subject uuid, p_angles text[])` RPC (same
authorization pattern as `admin_set_subject_hint`).

**Serving:** whatever RPC currently returns the day's live Subject to the
Today screen is extended to include `angles`. Shown as a small, low-emphasis
row of angle chips under the headline Subject text — present from the moment
the Shot drops, not hidden behind a tap or a struggle state.

**Content retrofit:** not a code task — a content pass over the existing 66
Subjects to add angles to any that are single-interpretation and
possession/weather-gated. Out of scope for the implementation plan; flagged
as a follow-up content task for whoever curates the library.

### 2. Open Frame relief day

Periodically (default: every 5th drop, config-driven, `open_frame_every_n_days`)
the day's Subject is drawn from a dedicated `category = 'open'` pool instead
of the normal ordered arc — headline text along the lines of "Open Frame —
anything, your eye." Still one theme, still blind vote, still one gallery;
it's a Subject like any other, just one with maximum built-in accessibility
by design, appearing on a predictable cadence so the arc's ordering intent
(`launch_prompts.sql`'s "confidence → danger → taste → payoff" comment) isn't
disturbed for the other 4 days out of 5.

**Schema:** extend the `subjects.category` CHECK constraint to allow `'open'`.

**Selection logic:** `drop_prompt()` (currently: `order by used_at asc nulls
first, seq asc nulls last, random()`) gets a cadence check — every Nth call
(tracked via a counter in `config`, mirroring how other tunables like
`quick_draw_minutes`/`vote_cap` are stored) picks from the `'open'` pool
first (same `used_at`-cycling rule as the main pool so Open Frame Subjects
don't repeat too soon either), otherwise falls through to the existing
ordered pick unchanged.

**Content:** a small seed batch of ~10-12 Open Frame Subjects (own migration,
same idempotent `where not exists` pattern as `20260721000012_seed_subjects.sql`).

### 3. Shield tuning (config + copy only)

No new mechanic. Two small changes:
- Review `streak_shield_max` / `streak_shield_regen` (currently 1/1) — with
  angle-hints and Open Frame days reducing genuine access-gap misses, the
  shield mainly needs to cover real-life misses (busy day, forgot); current
  values are probably fine, but worth a one-line config bump if alpha data
  shows shields running out before regen.
- Audit Today/Profile copy around a shield-covered miss to confirm it reads
  neutral/silent ("streak protected") not punitive — no code change unless
  an audit finds bad copy; if it does, it's a copy-only fix.

## Data flow / architecture impact

No changes to `close_day`, Bradley-Terry ranking, `get_gallery`, or the
`votes` table — angles are purely a presentation layer on top of the
existing Subject-drop flow, and Open Frame is just another Subject category
flowing through the same `subject_drops` → `curate`/`get_matchup` →
`close_day` pipeline everything else already uses. This keeps the change
additive, matching the project's standing rule (see `docs/build-roadmap.md`)
of no schema redesign during this phase.

## Testing

- Manual QA: confirm angle-hints render on Today at drop time (not just
  after a miss), confirm blind curation screen (`get_matchup`) never exposes
  angles or which angle (if any) a submission used.
- Manual QA: force an Open Frame day via dev time-machine tooling
  (`src/app/dev/time-machine`), confirm selection cadence and that it
  doesn't disturb the surrounding arc order.
- Config check: confirm `admin_set_subject_angles` authorization matches
  `admin_set_subject_hint` (admin-only, rejected for non-admins).

## Open questions for the implementation plan

- Exact RPC(s) that currently serve the live Subject to Today (needs a
  precise read of `lib/homeState.ts` / equivalent before writing the plan)
  and the matchup RPC that must be confirmed to never leak angle data.
- Where the "every Nth drop" counter lives — a new `config` row incremented
  in `drop_prompt()`, or derived from `count(*) from subject_drops where
  region = p_region` (no counter state needed, simpler, recommended).
- Whether angle-hints need per-region/localization handling given "global
  from day one" — likely not blocking for v1 (English-only alpha), flag for
  i18n phase.
