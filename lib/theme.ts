export const colors = {
  background: '#121212',
  surface: '#1E1E1E',
  textPrimary: '#F5F5F5',
  textMuted: '#8A8A8A',
  accent: '#FFFFFF',
  accentPressed: '#D6D6D6',
  border: '#2C2C2C',
} as const;

export const type = {
  hero: { fontSize: 32, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
} as const;

export const radius = {
  button: 100, // pill/stadium shape — also used by input fields, for full shape consistency
  card: 12,
} as const;
