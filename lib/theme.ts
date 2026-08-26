export const colors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceRaised: '#242424', // stacked sheets/modals over a card — tonal elevation, no shadow
  textPrimary: '#F5F5F5',
  textMuted: '#8A8A8A',
  accent: '#FFFFFF',
  accentPressed: '#D6D6D6',
  border: '#2C2C2C',
  disabledBg: '#2C2C2C', // same value as border by design — codifies the existing disabled-fill convention
  disabledText: '#8A8A8A', // same value as textMuted by design
  pressedOverlay: '#2C2C2C', // rows/cards pressed state — same value as border
} as const;

export const type = {
  hero: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  screenTitle: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.5 }, // sign-up, onboarding screen headings
  title: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
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
  card: 12,
} as const;

export const height = {
  control: 52, // buttons + inputs
  controlSm: 40, // secondary/inline actions only — still hit-slop to touchTarget.min
} as const;

export const touchTarget = {
  min: 48, // Android minimum touch target (dp) — use as hitSlop floor for icon-only controls
  gap: 8, // minimum space between adjacent tappable controls
} as const;
