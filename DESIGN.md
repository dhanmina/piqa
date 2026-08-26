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
| `spacing.sm` | 8 |
| `spacing.md` | 16 |
| `spacing.lg` | 24 |
| `radius.button` | 8 |
| `radius.card` | 12 |

## Component pattern

Buttons: solid `accent` (white) fill, `background`-colored text (dark text on the white button, for contrast), `radius.button` corners, `spacing.md`/`spacing.lg` vertical/horizontal padding. Pressed state dims to `border` gray, not a color shift. Established in `app/(auth)/sign-in.tsx`, reused via `lib/theme.ts`.

## Source of truth

All tokens live in `lib/theme.ts` — screens import from there rather than hardcoding hex values.
