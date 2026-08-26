# Piqa — Design System

## Palette: "Monochrome"

True neutral grayscale, no hue anywhere. Dark-first, no light mode variant yet. White is used sparingly as the only "accent" — CTAs and the streak count — everything else stays gray.

| Token | Hex | Use |
|---|---|---|
| `background` | `#121212` | Screen background |
| `surface` | `#1E1E1E` | Cards, elevated surfaces (peek-back card, sheets) |
| `surfaceRaised` | `#242424` | Stacked sheets/modals over a card — tonal elevation instead of shadow, per Material dark theme |
| `textPrimary` | `#F5F5F5` | Primary text, near-white |
| `textMuted` | `#8A8A8A` | Secondary/caption text, mid-gray |
| `accent` | `#FFFFFF` | Primary CTA fill, streak count — the only filled/bright element |
| `border` | `#2C2C2C` | Hairline dividers, card outlines |
| `disabledBg` | `#2C2C2C` | Disabled button/control fill (same value as `border` — codified as its own token so screens don't hardcode `border` for this meaning) |
| `disabledText` | `#8A8A8A` | Disabled control label (same value as `textMuted`) |
| `pressedOverlay` | `#2C2C2C` | Pressed-state fill for rows/cards (`SelectableRow`, `Card`) — same value as `border` |

No separate "warning" color — freeze/at-risk states are communicated via `border`/`textMuted` + copy or an icon, not a hue, to keep the palette genuinely monochrome.

## Type scale

System font (RN default) — no custom font family for now. Every role carries an explicit `lineHeight` (RN's default ~1.2× multiplier reads tight at the 32px `hero` size).

| Token | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| `hero` | 32 | 700 | 38 | Streak count on Today |
| `title` | 20 | 600 | 26 | Screen/section headers (Timeline, Profile) |
| `body` | 16 | 400 | 22 | Standard copy |
| `bodyBold` | 16 | 600 | 22 | Button labels, emphasis |
| `caption` | 13 | 400 | 18 | Muted/secondary text (peek-back label, timestamps) |

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
| `radius.button` | 100 (pill/stadium) | |
| `radius.card` | 12 | |
| `height.control` | 52 | Button + input height |
| `height.controlSm` | 40 | Secondary/inline actions only — still hit-slop to `touchTarget.min` |
| `touchTarget.min` | 48 | Android minimum touch target (dp) — use as `hitSlop` floor for icon-only controls (back/close), never shrink the tap area to match a small icon |
| `touchTarget.gap` | 8 | Minimum space between adjacent tappable controls |

## Component pattern

Native Android (Material 3-informed, not web defaults):

- **Buttons:** pill/stadium shape (`radius.button = 100`), solid `accent` (white) fill for primary actions, outlined (transparent + `border` outline) for secondary (Google sign-in). Disabled state fills `border` gray with `textMuted` label rather than dimming opacity. Pressed state dims to `accentPressed`/`border`, not a color shift.
- **Text fields:** same pill shape as buttons (`radius.button`, not a separate token) — `surface` fill, placeholder-driven (no separate label element above the value), transparent 1.5px border by default (kept constant-width to avoid layout shift when it turns on).
- **Loading/disabled states:** buttons disable and swap label text (e.g. "Sign in" → "Signing in…") while a request is in flight, rather than leaving the user without feedback.
- **Error states:** no hue for error, by palette rule — signaled structurally instead: the implicated field's border switches to `textPrimary` (white) via `FilledField`'s `error` prop, paired with a `⚠` glyph + bold caption from `FieldError`. `FieldError` reserves its line height (`type.caption.lineHeight`) whether or not a message is shown, so the message appearing/disappearing never shifts the layout. Errors attributable to one field (password mismatch, weak password, email already registered) render inline under that field; errors that can't be attributed to one field without leaking information (invalid credentials — never reveal which of email/password was wrong) render in a shared slot at the bottom of the form. Fields clear their own error the moment the user edits them, rather than leaving a stale message. Copy is mapped from Supabase error codes to product language in `lib/authErrors.ts`, not the raw SDK message.

## Shared components (`components/`)

Every screen composes from these instead of inline styles — extracted after the auth/onboarding screens each duplicated the same button/input styling:

| Component | Purpose |
|---|---|
| `Screen` | `SafeAreaView` + `background` + standard padding — the outer wrapper every screen uses |
| `Button` | primary (solid) / secondary (outlined) variants, disabled + loading states |
| `FilledField` | pill-shaped text input, placeholder-driven |
| `Card` | `surface` background, `radius.card` — for peek-back card, Mosaic tiles, Timeline cells (Tasks 9/10/12) |
| `SelectableRow` | pressable choice-list row (onboarding intent chips; reusable for any future choice list) |
| `Divider` | 1px `border`-colored hairline |
| `FieldError` | error message row — `⚠` glyph + bold caption, reserves its height so appearing/disappearing never shifts layout |

## Source of truth

All tokens live in `lib/theme.ts` — screens import from there rather than hardcoding hex values.
