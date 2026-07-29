# piqa — Design Review Summary

*Prepared 2026-07-29. This is the tracked, git-committed synthesis of a six-part design/UX/IA audit conducted via Claude Code. The full illustrated reports (with rendered mockups, computed contrast tables, and inline research citations) live in `docs/design-review/` — that folder is **gitignored** (reference material, not shipped/reviewed content), so this file is what survives in git history and PRs. Nothing described below has been implemented yet; the uncommitted gallery/share-badge work reviewed during the audit was reverted, not fixed, so the repo is currently clean at the last commit.*

## How to use this doc

- If you're picking this up cold: read this file first, then open the specific HTML report in `docs/design-review/` for the detail behind any item (research citations, computed numbers, visual mockups).
- Everything here is **planning, not done**. Cross-reference against `docs/piqa-current-status.md`-equivalent memory before assuming any item shipped.
- The six reports, in the order they were produced:

| # | File (in `docs/design-review/`, gitignored) | Covers |
|---|---|---|
| 1 | `01-system-analysis.html` | Personas, pain points, retention/monetization strategy, external benchmark research, phased execution plan |
| 2 | `02-component-icon-system.html` | Icon/control uniformity rules, spacing scale, full WCAG contrast ledger, Curate screen redline |
| 3 | `03-screens-layout-system.html` | Modal placement, search, avatar/list sizing, Profile/Settings/Camera audits, first Studio screen design |
| 4 | `04-final-audit-coverage.html` | Full-app coverage map (every screen/component read at least once), cross-cutting findings, consolidated punch list |
| 5 | `05-ia-findability-map.html` | Navigation/findability research, hub-and-spoke map, **Studios placement decision** (corrected twice), rendered tab-bar mockup |
| 6 | `06-today-screen-clutter.html` | Today screen clutter diagnosis + full redesigned layout for all 6 states (loading/error/waiting/live/submitted/done), rendered in HTML; corrects the Studios ambient-line suggestion from doc 5 |
| 7 | `07-studios-screen.html` | Full Studios screen design — empty state, create/join, standing view, invite, members, manage — the screen designed for the tab decided in doc 5 |

## Current status (2026-07-29)

- Build 6, closed testing, Day 1 = 2026-07-23. Baking for the retention gate — D7 read ~2026-07-30, D30 ~2026-08-22 (see `piqa-current-status.md` memory).
- The uncommitted gallery/share-badge diff reviewed during this audit (rank badges, share button, `dropMeta` eyebrow) was **reverted in full**, not selectively fixed. If that feature work is picked back up, re-read §02 of report 1 and §13 of report 2 first — the rank-badge/ordinal display is a **constitutional conflict** (violates "no visible ranks beyond PotD," spec §7 and the never-do list) and must not be reintroduced as originally written. The rest of that diff (heart chip, name chip, `ShareButton`, `dropMeta` eyebrow, past-drops sheet consolidation) was good work and fine to redo.
- `docs/piqa-spec-final.md` §11 and `docs/feature-research.md` §4b have been updated with pointer notes to the Studios nav decision below.

---

## Locked-in decisions

### Navigation — Studios promoted to a tab

Final structure (corrected twice during review — see report 5 for the full back-and-forth):

```
Today · Gallery · [ ● shutter ] · Studios · Profile
```

- Archive relocates from the tab bar into a **Profile section** (reuses the existing Wins/Starred segmented-toggle pattern). It's solo/private and doesn't need top-level real estate the way a friends feature does.
- Studios gets a real tab because it's the single feature the team's own docs call "the strongest D7/D30 lever" — a friends-driven mechanic needs the same always-there prominence a tab carries, not a toggle inside Gallery (the first-draft idea) or a Profile row (the very first draft). Duolingo's own Feb 2026 nav redesign (Friends + Leaderboard as full tabs) is the live precedent that reversed the earlier, too-conservative "keep it nested" recommendation.
- Inside the Studios tab: default view is the read-only standing line ("N of your Studio made the gallery today"); create/invite/leave is one tap deeper within that same tab.
- Today gets **no new UI** for this — the existing `friendShotCount` social-proof line (Live and Submitted states) will simply prefer Studio-mates once Studios ships, instead of adding a new line. (This correction happened *because* report 6 found Today already has real density problems — see below — so piling another line on top would have compounded them.)
- Staging: build behind the existing Phase-1 config-table flag pattern (`getConfig('studios_enabled')`-style), dark-launch to a slice, confirm engagement, then widen the tab to everyone.

### Today screen — the one real clutter finding, and it's precise

Verdict from report 6: **no decision-fatigue problem** (one primary action per state, always) — **yes, a reading-load problem**, in exactly two spots:

1. **Header:** "Share your week" renders any time the user has shot at least once in the trailing 7 days — effectively permanent after week one, and it doesn't semantically belong with the streak/date/bell status chunks around it. **Fix:** move it into the Done-state teaser (contextual, right when a week's results land) with a Profile row as a backup entry point for anytime access — not a new nav item, matches the low-frequency-nested pattern used for Edit Profile/Frame Picker.
2. **Submitted state:** four caption lines stack simultaneously in the common case (status / "results at X" / friend-or-shot count / "tomorrow's subject drops at Y"). **Fix:** keep the status line + "results at" line only; drop the social-proof count from this state (it's motivating in Live, not here); **cut** the tomorrow's-teaser entirely — Done already renders a `NextShot` line for the same information, so relocating it would just duplicate that line.

Bonus (senior-dev lens): `today.tsx` is 811 lines with all five states branched inline in one render function. Recommended a pure refactor — extract each state into its own named component — no behavior change, easier to review, and safer to add the Studios social-proof preference into later without touching four other states in the same diff.

All six states (loading/error/waiting/live/submitted/done) were then rendered in full in report 6 to confirm the fixes hold end-to-end. One mockup correction worth recording: the first pass drew the Live and Submitted brackets as a solid box border — the real `Brackets` component (and `tokens.brackets`, `armLength:16`) is four independent corner ticks with gaps along the edges, viewfinder-style, never a continuous rectangle, and is `paper`-colored by default (not `safelight` — that's reserved for the eyebrow text/countdown, with `crown` gold only on rare "Golden Shot" event days). Fixed in the mockup; worth remembering as a general rule when illustrating anything framed in this system.

### The P0 constitutional-conflict finding (resolved by reverting)

The uncommitted gallery diff added numbered 1–2–3 rank badges to World gallery tiles and a "YOUR SHOT #{rank}" header line. This directly violates the spec's own never-do list ("visible ranks beyond PotD") and §7 ("Only #1 is public. No 2nd/3rd, no positions"). The code comment in that diff literally named the mechanism the law exists to prevent: *"loss aversion: 'your shot is #4' drives re-engagement."* This is now moot since the diff was reverted, but flagged here so it isn't silently reintroduced — if the heart-chip/share/name-chip work from that diff gets redone, drop the ordinal and keep hearts-only recognition ("12 hearts on your shot" / "Picked N times by curators"), matching how `today.tsx`'s own Done state already phrases a non-gallery result.

---

## Design system reference

### Spacing — the 4pt sub-grid piqa already half-follows

`tokens.ts` already implies a 4pt base (`space.gutter`=20, `control.chrome`=40 are both ×4), it was just never declared as a rule. Off-grid literals found across the audit (all fail even the ×4 test): **2, 3, 6, 7, 9, 10, 14, 18, 30, 46** — recurring across `MatchupPair.tsx`, `curate.tsx`, `today.tsx`, `archive.tsx`, `activity.tsx`, `auth.tsx`, `onboarding.tsx`, `ReportSheet.tsx`, `Toast.tsx`, `UpdatePrompt.tsx`, `AnalyticsConsent.tsx`, `PastDropsCalendar.tsx`, `PagerDots.tsx`, `LegalDoc.tsx`, `reveal.tsx`. Proposed token additions (report 2, §03): `space.xxs=4, xs=8, sm=12, md=16, lg=24, compact=36` (the last one formalizes a magic number already hand-typed three times).

### Avatar scale — should be 32/40/48/56/64

Found in use today: 30 (FacePile), 40 (Avatar default), 44 (Activity row), 48 (shared UserRow), 52 (FramePicker preview), 56 (search row, Profile crest), 104 (edit-profile picker — legitimately deserves its own tier, just needs a name instead of a hand-typed literal, e.g. `avatarXL`). Fixes: FacePile 30→32, Activity 44→48, FramePicker 52→48, reactors-sheet-avatar 36→32.

### Icon-per-concept conflicts (one glyph per action, everywhere)

| Concept | Competing icons found | Fix |
|---|---|---|
| Report | `Flag` (Curate) vs `MoreHorizontal` (Photo detail) | Unify on `Flag` |
| Back | `ChevronLeft` (header) vs `ArrowLeft` (Gallery inline link) | Drop the icon on the inline link (it's a "jump to latest," not "back") |
| Share | `Share` (photo/grid) vs `Share2` (profile) | Unify on `Share` |
| Heart | custom `HeartGlyph` (everywhere) vs lucide `Heart` (Activity's appreciation row only) | Swap Activity to `HeartGlyph` |
| Archive/library | `BookImage` (×3) vs `BookOpen` (admin only) | Unify on `BookImage` |

### Contrast ledger — the honest result

Every real color pairing in the app was computed against the WCAG relative-luminance formula, including the worst case (a translucent badge over a pure-white photo). Result: **everything passes AA** except one — `paper40` on inactive tab labels measures 3.5:1 (fails the 4.5:1 small-text minimum). One-line fix: bump to ~48–50% opacity. Also formalized a rule worth keeping: `overlay.chip` (55% opacity) is icon-only chrome (3:1 threshold); anywhere text sits on a photo, use `overlay.badge` (75%, verified AA-safe even over a white photo).

### Token hygiene — the near-black epidemic

Nine instances across 8 files hand-roll a near-black backdrop (`rgba(12,11,10,*)`, `#080706`, `rgba(8,7,6,*)`) instead of the real `colors.ink`-based token. Fix: add `overlay.scrimHeavy: 'rgba(20, 18, 16, 0.95)'`, replace all nine. `UpdatePrompt.tsx` and `AnalyticsConsent.tsx` already do this correctly — proof the right pattern already exists, it just needs to spread.

### Loading states — six different patterns, one unused shared component

Today (hand-rolled skeleton), Archive (hand-rolled, different shape), Search (own `RowSkeleton`), Activity (`ActivityIndicator` spinner — the one screen that spins, in tension with the app's own "exactly three moments animate" law), Reveal (renders nothing while loading), Weekly Recap (bare text line). A shared `Skeleton.tsx`/`SkeletonAvatar`/`SkeletonBar` molecule exists — its own doc comment names the four screens it was built to fix — and is imported by **none of them**. Fix: adopt it as the shared primitive; each screen still composes its own layout shape from it.

---

## The consolidated punch list (Phase 0 — all OTA-safe, no migration, no native build)

1. Declare the `space` scale (`xxs/xs/sm/md/lg/compact`) in `tokens.ts`; sweep the ~35 off-grid literals listed above.
2. Bump `paper40` opacity to clear WCAG AA on inactive tab labels.
3. Add `overlay.scrimHeavy`; replace all 9 hand-rolled near-black instances.
4. Fix the 4 avatar-scale outliers (FacePile, Activity, FramePicker, reactors sheet); name edit-profile's 104 as `avatarXL`.
5. Unify the 4 icon-per-concept splits (report, back, share, heart).
6. Adopt `Skeleton.tsx` in Today/Archive/Search; switch Activity off `ActivityIndicator`.
7. Consolidate `search.tsx`'s inline `UserRow` into the shared component.
8. Give `weekly-recap.tsx` the standard top-left close chip (currently a bottom text link); move its trigger to the Done-state teaser + a Profile-row backup (see above).
9. Collapse the Submitted state's four stacked lines to two (see above).
10. Add the domain/credit line to `WeeklyRecapCard` (currently missing it; `ShareCard` has it and explicitly reasons why it's needed on the exported image itself).
11. Route `onboarding.tsx`/`PermissionBlock.tsx`'s large icons through the existing `iconStroke()` helper instead of hardcoded `strokeWidth`.
12. Move Archive's star-toggle overlay into `PhotoTile` as a prop (currently split between the component and the screen).
13. Add a visible dismiss control to `Sheet.tsx` (its grab handle is decorative only — no gesture wired to it).
14. Extract `today.tsx`'s five inline state branches into named components (pure refactor).

**Phase 1** (dark plumbing, no user-facing change): RevenueCat SDK + entitlement webhook (the one item in the whole plan needing a native build — batch it with removing the unused `expo-glass-effect` dependency), Clash Display font landing (`CLASH_DISPLAY_LOADED` is still `false`), the `IconButton` `slot`-prop refactor, in-app feedback channel, onboarding funnel instrumentation.

**Phase 3**: Studios build (schema + RPCs + the tab), gated behind a config flag, staged rollout — see report 5 for the full layout spec.

Full detail, research citations, and computed numbers for every item above are in the corresponding `docs/design-review/*.html` file.
