# Piqa — Design System

## Palette: "Monochrome"

True neutral grayscale, no hue anywhere. Dark-first, no light mode variant yet. White is used sparingly as the only "accent" — CTAs and the streak count — everything else stays gray.

| Token | Hex | Use |
|---|---|---|
| `background` | `#121212` | Screen background |
| `surface` | `#1E1E1E` | Cards, elevated surfaces (peek-back card, sheets) |
| `textPrimary` | `#F5F5F5` | Primary text, near-white |
| `textMuted` | `#8A8A8A` | Secondary/caption text, mid-gray |
| `accent` | `#FFFFFF` | Primary CTA fill, streak count — the only filled/bright element |
| `border` | `#2C2C2C` | Hairline dividers, card outlines, pressed-state fill |

No separate "warning" color — freeze/at-risk states are communicated via `border`/`textMuted` + copy or an icon, not a hue, to keep the palette genuinely monochrome.

## Type scale

System font (RN default) — no custom font family for now.

| Token | Size | Weight | Use |
|---|---|---|---|
| `hero` | 32 | 700 | Streak count on Today |
| `body` | 16 | 400 | Standard copy |
| `bodyBold` | 16 | 600 | Button labels, emphasis |
| `caption` | 13 | 400 | Muted/secondary text (peek-back label, timestamps) |

## Spacing & radius

| Token | Value |
|---|---|
| `spacing.xs` | 4 |
| `spacing.sm` | 8 |
| `spacing.md` | 16 |
| `spacing.lg` | 24 |
| `radius.button` | 100 (pill/stadium) |
| `radius.card` | 12 |

## Component pattern

Native Android (Material 3-informed, not web defaults):

- **Buttons:** pill/stadium shape (`radius.button = 100`), solid `accent` (white) fill for primary actions, outlined (transparent + `border` outline) for secondary (Google sign-in). Disabled state fills `border` gray with `textMuted` label rather than dimming opacity. Pressed state dims to `accentPressed`/`border`, not a color shift.
- **Text fields:** same pill shape as buttons (`radius.button`, not a separate token) — `surface` fill, placeholder-driven (no separate label element above the value), no border/underline.
- **Loading/disabled states:** buttons disable and swap label text (e.g. "Sign in" → "Signing in…") while a request is in flight, rather than leaving the user without feedback.

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

## Source of truth

All tokens live in `lib/theme.ts` — screens import from there rather than hardcoding hex values.
