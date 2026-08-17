/**
 * Darkroom design system — spec §11b. The single source of visual truth.
 *
 * Laws encoded here:
 * - One safelight accent per screen. Crown gold appears once a day (PotD only).
 * - Paper is #F2EDE4, never #FFF.
 * - Photos are 0 radius (prints, not bubbles); UI surfaces are 12.
 * - ALL numbers render in IBM Plex Mono (camera-readout language).
 * - No gradients, no glassmorphism, no sound. Dark-first single theme.
 */

export const colors = {
  ink: '#141210', // background
  ink2: '#201D19', // cards, sheets, skeletons
  paper: '#F2EDE4', // primary text — never #FFF
  paper60: 'rgba(242, 237, 228, 0.6)', // secondary text
  paper40: 'rgba(242, 237, 228, 0.48)', // inactive tabs — bumped from .4 for WCAG AA (2026-07-29 audit)
  paper30: 'rgba(242, 237, 228, 0.3)', // disabled
  safelight: '#FF5A36', // THE accent: actions, streak, live
  crown: '#E3B341', // PotD only — once per day
  heart: '#E6453C', // filled heart only
} as const;

/**
 * Font families. Clash Display ships from local assets (Fontshare) and is used
 * for display moments only; until the files land in assets/fonts/ we fall back
 * to Instrument Sans SemiBold. See fonts.ts.
 */
export const fonts = {
  display: 'ClashDisplay-Semibold',
  displayFallback: 'InstrumentSans_600SemiBold',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

/** Type scale — spec: 34/24/17/15/13 (+11 for tab labels). */
export const typeScale = {
  display: 34,
  title: 24,
  body: 17,
  sub: 15,
  caption: 13,
  tabLabel: 11,
} as const;

export const radius = {
  photo: 0, // prints, not bubbles — never round a photo
  card: 12,
  sheetTop: 24,
  pill: 999,
} as const;

/**
 * Overlays are always ink-tinted — never pure black — so dimmed surfaces still
 * read as the darkroom, not a generic modal. One value per job, used everywhere
 * so no screen hand-rolls its own rgba.
 */
export const overlay = {
  scrim: 'rgba(20, 18, 16, 0.6)', // full-screen backdrop behind sheets/modals
  chip: 'rgba(20, 18, 16, 0.55)', // floating chrome controls over media
  badge: 'rgba(20, 18, 16, 0.75)', // small badges/labels over a photo
  scrimHeavy: 'rgba(20, 18, 16, 0.95)', // near-opaque backdrop — replaces hand-rolled near-blacks
} as const;

/** Bottom legibility fade for text/controls over a photo — one gradient
 *  everywhere (detail view, PotD cover, grid tiles), never a per-screen opacity. */
export const fade = ['rgba(20, 18, 16, 0)', 'rgba(20, 18, 16, 0.9)'] as const;

/** Floating chrome controls (close, flash, back…) — one size, one icon glyph. */
export const control = {
  chrome: 40, // circular button diameter
  icon: 22, // lucide glyph size inside a chrome/header button
} as const;

/**
 * Shared card/surface style — the single source for the darkroom surface color
 * and radius. Eliminates the 10+ identical `{ backgroundColor: colors.ink2,
 * borderRadius: radius.card }` style definitions scattered across admin,
 * settings, gallery, and activity screens.
 */
export const card = {
  backgroundColor: colors.ink2,
  borderRadius: radius.card,
  overflow: 'hidden' as const,
} as const;

/**
 * Every Piqa photo is 4:5 portrait — one uniform frame. This is the single
 * source of truth: capture preview, the baked upload crop, and every grid/tile
 * use it, so what you frame is exactly what gets stored and shown everywhere.
 */
export const photo = {
  aspect: 4 / 5, // width / height — portrait
} as const;

/**
 * The frame is a print: a 750x1000 canvas whose photo window is x24-726 / y24-904,
 * with a rail below it carrying the maker's mark, the day counter and the dot.
 *
 * FramedPhoto states every coordinate in these reference units and lets the SVG
 * viewBox do the scaling — nothing is ever multiplied by a device scale factor by
 * hand, so there are no pixel values to drift. The window is expressed as
 * percentages for the same reason.
 *
 * Note the two aspects are NOT the same: the print is 3:4 (it includes the rail),
 * the window inside it is 702x880 ≈ 4:5 — which is the photo aspect above, so a
 * stored photo fills the window with no visible crop.
 */
export const frame = {
  aspect: 3 / 4, // the whole print, rail included
  window: { left: '3.2%', right: '3.2%', top: '2.4%', bottom: '9.6%' }, // 24 / 24 / 24 / 96 of 750x1000
} as const;

/** 4pt sub-grid — tokens.ts already implied this (gutter=20, chrome=40 are
 *  both ×4), this just names the steps so screens stop hand-typing literals. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  compact: 36,
  gutter: 20,
  gridGap: 8,
  target: 48, // minimum touch target
  buttonHeight: 52, // primary pill
  shutter: 60, // raised center shutter diameter
} as const;

/** Motion — exactly three moments animate; everything else is still. */
export const motion = {
  bracketSnapMs: 200, // focus-lock submit
  revealStaggerMs: 60, // morning gallery FadeInUp
  voteAdvanceMs: 150, // next pair slides in
  pressScale: 0.97, // universal press affordance (no ripples)
  toastMs: 2000,
  heartSpring: 1.1,
  relighPulse: 1.3, // streak dead→alive flare scale
} as const;

/** Lucide settings — one family, warm stroke. */
export const icons = {
  // lucide is drawn on a 24px grid FOR stroke 2 — that's its designed, crispest
  // weight. Anything heavier over-thickens the glyph and closes up its inner space.
  strokeWidth: 2,
  emptyStateSize: 32,
} as const;

/**
 * Optical stroke for a given icon size. lucide's stroke scales with the glyph, so
 * a fixed weight renders ~3px on a 32px icon (chunky) yet thin on a 12px one. This
 * holds the ON-SCREEN stroke at the designed weight for display icons (size ≥ 24)
 * so large glyphs stay refined, and keeps the base weight for small UI icons.
 */
export function iconStroke(size: number): number {
  if (size <= 24) return icons.strokeWidth;
  return Math.max(1.5, +(icons.strokeWidth * (24 / size)).toFixed(2));
}

/** Avatar scale — 32/40/48/56/64, named so nothing hand-types a size again.
 *  `avatarXL` is the edit-profile picker's own tier (legitimately larger). */
export const avatar = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
  xxl: 64,
  avatarXL: 104,
} as const;

/** Viewfinder bracket geometry (the signature motif). */
export const brackets = {
  thickness: 2,
  armLength: 16,
  gap: 6,
} as const;
