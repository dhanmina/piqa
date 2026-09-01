export const colors = {
  background: '#0A0A0A',
  surface: '#161616',
  surfaceRaised: '#1E1E1E', // stacked sheets/modals over a card — tonal elevation, no shadow
  textPrimary: '#F5F5F5',
  textMuted: '#8A8A8A',
  textFaint: '#4A4A4A', // day labels, hairline captions — a step quieter than textMuted
  accent: '#FFFFFF',
  accentPressed: '#D6D6D6',
  trace: '#FFFFFF', // the streak line — same value as accent, named for where it's drawn
  border: '#262626',
  gridLine: '#1E1E1E', // calibration hairlines (trace baseline, plate rules) — between surface and border
  disabledBg: '#262626', // same value as border by design — codifies the existing disabled-fill convention
  disabledText: '#8A8A8A', // same value as textMuted by design
  pressedOverlay: '#262626', // rows/cards pressed state — same value as border
} as const;

// Monospace is reserved for data and measurement — streak counts, dates, stamped
// readouts — never for prose or labels. That split is what carries the recorder/
// instrument character; system monospace (no font asset, no new dependency).
const MONOSPACE = 'monospace'; // Android system monospace; Menlo on iOS when that platform ships

export const type = {
  wordmark: { fontSize: 40, fontWeight: '700' as const, lineHeight: 46, letterSpacing: -1 }, // the "piqa" hero mark on sign-in/sign-up
  hero: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  screenTitle: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.5 }, // sign-up, onboarding screen headings
  title: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  // Data readouts — streak counts, dates, stamped labels, stat values.
  dataHero: { fontSize: 40, fontWeight: '600' as const, lineHeight: 44, fontFamily: MONOSPACE },
  data: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, fontFamily: MONOSPACE },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  button: 100, // pill/stadium shape — also used by input fields, for full shape consistency
  card: 8, // tighter than a typical app card — reads as an instrument plate, not a rounded tile
} as const;

export const height = {
  control: 52, // buttons + inputs
  controlSm: 40, // secondary/inline actions only — still hit-slop to touchTarget.min
} as const;

export const touchTarget = {
  min: 48, // Android minimum touch target (dp) — use as hitSlop floor for icon-only controls
  gap: 8, // minimum space between adjacent tappable controls
} as const;

// Every capture is cropped to this ratio (width/height) at shoot time, so any
// container displaying a full (uncropped-by-grid) photo should use the same
// ratio — screen-relative heights (e.g. '70%') vary by device and reintroduce
// the per-phone mismatch the crop was meant to fix.
export const PHOTO_ASPECT_RATIO = 3 / 4;
