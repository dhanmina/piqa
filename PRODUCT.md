# Piqa

A personal daily photo-capture streak app. Capture one or more photos a day, any time, no daily prompt or gate. A forgiving streak (2 freeze credits/week) keeps the habit without punishing a missed day. The core delight hook is "Peek Back" — surfacing a photo from your own past (same day last week, last month, last year) each time you open the app.

Solo and private by design: no feed, no likes, no comments, no comparison metrics, no other users' content anywhere in the core loop. A personal archive, not a social network. (A future optional "Streak Buddy" layer exists in the product spec but is out of scope for the current build.)

## Platform

Android-only for now (no iOS, no web). Expo/React Native + TypeScript, expo-router, Supabase backend.

## Design mood

Monochrome and clean — true neutral grayscale, no hue anywhere. White used sparingly as the only "accent" (CTAs, streak count); everything else stays gray. Restrained and quiet in layout density (no gamified chrome, no badges/confetti, no color-coded states) — clarity comes from contrast and spacing, not decoration.

Dark-first, no light mode for now.

## Full spec references

- `docs/superpowers/specs/2026-08-24-piqa-mvp-design.md` — product/feature spec
- `docs/superpowers/specs/2026-08-24-piqa-architecture-design.md` — screens, nav, data model
- `docs/superpowers/plans/2026-08-24-piqa-core-loop.md` — the 13-task implementation plan
