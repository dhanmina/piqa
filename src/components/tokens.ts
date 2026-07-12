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
  paper40: 'rgba(242, 237, 228, 0.4)', // inactive tabs
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
 * Every Piqa photo is 4:5 portrait — one uniform frame. This is the single
 * source of truth: capture preview, the baked upload crop, and every grid/tile
 * use it, so what you frame is exactly what gets stored and shown everywhere.
 */
export const photo = {
  aspect: 4 / 5, // width / height — portrait
} as const;

export const space = {
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
} as const;

/** Lucide settings — one family, warm stroke. */
export const icons = {
  strokeWidth: 2.25,
  emptyStateSize: 32,
} as const;

/** Viewfinder bracket geometry (the signature motif). */
export const brackets = {
  thickness: 2,
  armLength: 16,
  gap: 6,
} as const;
