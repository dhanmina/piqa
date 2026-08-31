# Piqa — Design System

## World: "Strip-Chart Recorder"

The streak is drawn as one continuous ink trace on a recording roll, not a card feed or a row of discrete dots. Captured days join into a solid line; a freeze credit continues the line dashed (forgiving, but never erased); a missed day is a real gap in the ink; today is the pen head still writing. Peek Back and same-day captures are plain full-bleed photo plates with a hairline-divided monospace caption row below — no chrome on the photo itself. True neutral grayscale throughout (no hue anywhere), dark-first, no light mode. See `app/_layout.tsx`'s top-of-file comment for the full direction contract this was built against.

## Palette

| Token | Hex | Use |
|---|---|---|
| `background` | `#0A0A0A` | Screen background — the recording paper |
| `surface` | `#161616` | Cards, plates, elevated surfaces |
| `surfaceRaised` | `#1E1E1E` | Stacked sheets/modals over a card — tonal elevation instead of shadow |
| `textPrimary` | `#F5F5F5` | Primary text, near-white |
| `textMuted` | `#8A8A8A` | Secondary/caption text, mid-gray |
| `textFaint` | `#4A4A4A` | A step quieter than `textMuted` — day labels, hairline captions, missed-day text |
| `accent` | `#FFFFFF` | Primary CTA fill — the only filled/bright control |
| `accentPressed` | `#D6D6D6` | Pressed accent state; also the freeze/dashed-trace color |
| `trace` | `#FFFFFF` | The streak line and pen-head — same value as `accent`, named for where it's drawn (`WeekStrip`, `MonthGrid`'s today border, `TabBar`'s active tick) |
| `border` | `#262626` | Hairline dividers, card outlines |
| `gridLine` | `#1E1E1E` | Calibration hairlines — trace baseline gaps, missed-day fill |
| `disabledBg` / `pressedOverlay` | `#262626` | Same value as `border` by design |
| `disabledText` | `#8A8A8A` | Same value as `textMuted` by design |

No separate "warning" color — at-risk states are communicated via `border`/`textMuted`/`textFaint` and line form (dash, gap), never a hue.

## Type scale

System font (RN default) — no custom font family. Monospace is reserved for **data and measurement only** — streak counts, dates, stamped labels, stat values — never for prose or labels; that split is what carries the recorder character. Every role carries an explicit `lineHeight`.

| Token | Size | Weight | Family | Use |
|---|---|---|---|---|
| `wordmark` | 40 | 700 | sans | The "piqa" hero mark on sign-in/sign-up |
| `hero` | 32 | 700 | sans | Non-numeric hero state ("Start today") |
| `screenTitle` | 28 | 700 | sans | Sign-up, onboarding screen headings |
| `title` | 20 | 600 | sans | Screen/section headers |
| `body` | 16 | 400 | sans | Standard copy |
| `bodyBold` | 16 | 600 | sans | Button labels, emphasis |
| `caption` | 13 | 400 | sans | Muted/secondary text, labels |
| `dataHero` | 40 | 600 | **mono** | Streak count hero (Today, Profile current streak) |
| `dataLg` | 17 | 500 | **mono** | Secondary stat values (Profile longest streak, `Chip` values) |
| `data` | 13 | 400 | **mono** | Date readouts, month labels, day numbers, plate timestamps |

## Spacing, sizing & radius

| Token | Value | Use |
|---|---|---|
| `spacing.xxs` | 2 | Icon-to-label gap, tight inline |
| `spacing.xs` | 4 | |
| `spacing.sm` | 8 | |
| `spacing.md` | 16 | Also the standard screen horizontal margin |
| `spacing.lg` | 24 | Section gap |
| `spacing.xl` | 32 | Major section break |
| `spacing.xxl` | 48 | Screen top/bottom breathing room, empty states |
| `radius.button` | 100 (pill/stadium) | Controls — buttons, inputs. Unchanged: Material-correct, deliberately not part of this redesign. |
| `radius.card` | 8 | Plates/cards — tighter than a typical rounded app card, reads as an instrument panel |
| `height.control` | 52 | Button + input height |
| `height.controlSm` | 40 | Secondary/inline actions only — still hit-slop to `touchTarget.min` |
| `touchTarget.min` | 48 | Android minimum touch target (dp) |
| `touchTarget.gap` | 8 | Minimum space between adjacent tappable controls |

## Recorder-world patterns

- **Streak trace (`WeekStrip`):** the signature component. Renders `DayCell[]` as one continuous baseline — solid `trace`-colored segments between captured days, dashed `accentPressed` segments through a freeze, a `gridLine` gap through a miss, ending in an enlarged `trace` pen-head node on today. `MonthGrid` uses the identical state→color mapping (`trace` border for today, dashed `accentPressed` for frozen, `gridLine` fill for missed) so the streak means the same ink everywhere it's drawn. No `react-native-svg`/canvas — pure `View` segments.
- **Photo plate (`PeekBackCard`, `CapturedTodayCard`):** a full-bleed photo, hairline `border` outline on the whole card, and a caption row below the image (not overlaid on it) — small caps label left, monospace value right, separated from the photo by a `border` hairline. Replaced an earlier four-corner-registration-tick-plus-overlay-box treatment that read as cluttered against the product's clean-monochrome goal; the plate identity now comes from the hairline border and the label/value pairing alone.
- **Stat readout strip (`Chip`):** replaced a bordered pill "tag" — pill chips read as social/gamified badges, which conflicts with the product's no-badges rule. Takes `stats: {value, label}[]` and renders a hairline-bounded row, monospace value over a small caps label, divided by a vertical rule between entries.
- **Baseline tab tick (`TabBar`):** the active tab drops the filled rounded-rect indicator for a small `trace`-colored tick beneath the icon — the same axis-mark language as the streak trace, everywhere in the app.
- **Floating nav bar + shared icon set (`TabBar`, `components/NavIcons.tsx`):** the bar pulls in from both screen edges (`spacing.md` margin) and fully rounds (`radius.button`) instead of running edge-to-edge with a hairline top border — softer footprint, `surface` fill, `border` outline, a soft drop shadow instead of a flat divider line. Icons switched from `expo-symbols` (SF Symbols on iOS / Material Symbols on Android — two different symbol catalogs with no shared visual language) to user-specified solid, rounded glyphs drawn directly via `react-native-svg` (`NavIcons.tsx`) — one shape renders identically on both platforms. No separate outline/filled pair per icon; focused vs. unfocused state reads through color (`textPrimary`/`textMuted`) plus the baseline tick, not a shape swap. `react-native-svg` is a real added native dependency (the trace and every other pattern above deliberately avoid one) — justified here because arbitrary icon curves aren't reproducible as plain `View` borders the way the trace's straight/dashed segments are.
- **No redundant capture entry point:** Today's uncaptured state is a quiet pending indicator (open ring + caption), not a duplicate full-width button — the camera FAB docked in `TabBar` is the app's one capture action, matching Material's one-FAB-one-primary-action rule.

## Component pattern (native Android, Material 3-informed — unchanged by this redesign)

- **Buttons:** pill/stadium shape (`radius.button = 100`), solid `accent` fill for primary actions, outlined for secondary. Disabled state fills `border` gray with `textMuted` label. Pressed state dims to `accentPressed`/`border`.
- **Text fields:** same pill shape as buttons — `surface` fill, placeholder-driven, transparent 1.5px border by default (constant-width to avoid layout shift).
- **Loading/disabled states:** buttons disable and swap label text (e.g. "Sign in" → "Signing in…") while a request is in flight.
- **Error states:** no hue, no emoji/symbol glyphs — the implicated field's border switches to `textPrimary` via `FilledField`'s `error` prop, paired with a bold `textPrimary` caption from `FieldError`, which reserves one caption line-height whether or not a message is shown. Sign-up's username field speaks up only on a problem (bad format, taken, couldn't check) — silent on success, matching Instagram/Twitter-style silent-success/vocal-failure convention. Copy is mapped from Supabase error codes to product language in `lib/authErrors.ts`.
- **Icons:** `expo-symbols`' `SymbolView` — real SF Symbols on iOS, real Material Symbols on Android, from one `{ ios, android }` name pair. This is still correct for icons *outside* the nav bar (settings gear, back chevron, password eye toggle, frozen/multi-photo badges) — the nav bar's icons deliberately moved off it, see Recorder-world patterns above; the two systems coexist on purpose, not an inconsistency to fix.

## Shared components (`components/`)

| Component | Purpose |
|---|---|
| `Screen` | `SafeAreaView` + `background` + standard padding — the outer wrapper every screen uses |
| `Button` | primary (solid) / secondary (outlined) variants, disabled + loading states |
| `FilledField` | pill-shaped text input, placeholder-driven |
| `Card` | `surface` background, `radius.card` — the base plate for stats, forms, list containers |
| `NavIcons` | `HomeIcon`/`TimelineIcon`/`CameraIcon`/`PeopleIcon`/`PersonIcon` — the nav bar's shared icon set, exact SVG paths via `react-native-svg`, one shape on both platforms |
| `Chip` | two-up (or more) monospace stat readout strip — see Recorder-world patterns above |
| `SelectableRow` | pressable choice-list row (onboarding intent chips) |
| `Divider` | 1px `border`-colored hairline |
| `FieldError` | error message row — plain bold caption, reserves one line-height |
| `TextLink` | tappable text-only action (`default`: bold wayfinding; `muted`: de-emphasized/destructive-adjacent) |
| `PhotoViewerModal` | full-screen photo viewer — transparent `Modal` over a 90%-black backdrop |
| `AuthHero` | the "piqa" wordmark + tagline, centered |

## Coverage

The trace/plate/readout language above is built into Today, Timeline, and Profile — the daily-use core loop. Settings, auth, onboarding, capture, recap, edit-profile, and change-password deliberately inherit only the foundation tokens (palette, spacing, `Card`/`Button`/`FilledField`/`AuthHero`) and were not given bespoke trace or plate treatment: they're plain utilitarian forms, and per this product's Operate-mode restraint, task clarity outranks expression there. This is a decision, not an omission — a settings list wearing recorder-plate chrome would be exactly the over-decoration the product's no-gamified-chrome rule warns against.

## Source of truth

All tokens live in `lib/theme.ts` — screens import from there rather than hardcoding hex values.
