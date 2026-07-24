# TODO — must clear before launch

Things that must not silently ship. Check items off only when done on-device.

## Safety & store compliance (GATES production access)

- [x] **Block + report** — already shipped: block on every profile, report on
      every fullscreen photo + curation matchup, mutual-invisibility filtering
      in `get_matchup`/`get_gallery`, 3-reporter auto-quarantine, `/admin` triage.
- [x] **Manage/unblock** — Settings → SAFETY → Blocked accounts (`/blocked`),
      so a mistaken block can be undone. Built 2026-07-24.
- [ ] **Mature-content control** — the one open safety item: a "Blur sensitive
      content" toggle (manual report → hide covers the gap until the NSFWJS
      classifier lands). See `docs/build-roadmap.md` → Phase 1.5A.

## Brand assets

- [ ] **Custom asymmetric heart SVG** — `src/components/atoms/HeartGlyph.tsx`
      currently draws a stock symmetric heart. Replace with the real identity
      icon (one of the 3 custom SVGs: heart / flame / crown), stroke weight
      matched to Lucide 2.25. Consumers (HeartButton, PhotoTile, GalleryGrid)
      pick it up automatically once the path is swapped.
- [ ] **Custom flame + crown identity SVGs** (spec §11e) — StreakFlame and the
      PotD crown currently use stock Lucide `Flame`/`Crown`.

## Fonts

- [ ] **Clash Display Semibold is NOT loading yet** — display text silently
      falls back to Instrument Sans SemiBold (`/dev/kit` shows
      "Clash loaded: false" until fixed). To fix:
      1. Download the Clash Display family (free) from Fontshare:
         https://www.fontshare.com/fonts/clash-display → "Download family".
      2. From the zip, take `ClashDisplay-Semibold.otf`
         (in `Clash Display/Fonts/OTF/`).
      3. Place it at `assets/fonts/ClashDisplay-Semibold.otf` (create the dir).
      4. In `src/components/fonts.ts`: add
         `'ClashDisplay-Semibold': require('@/assets/fonts/ClashDisplay-Semibold.otf'),`
         to the `useFonts` map and flip `CLASH_DISPLAY_LOADED` to `true`.
      5. Confirm `/dev/kit` reads "Clash loaded: true".

## Release config

- [ ] **Android package rename** — still `com.anonymous.piqa`; spec §1 mandates
      the permanent brand-tied id `com.joinpiqa.piqa`. Change `android.package`
      in app.json + re-run prebuild BEFORE the first Play Console upload
      (package ids are immutable once uploaded).
