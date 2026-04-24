// Design tokens matching the FreshTrack-style Figma designs
export const Colors = {
  // Primary green palette
  primary: '#4CAF50',
  primaryLight: '#81C784',
  primaryDark: '#388E3C',
  primaryBg: '#E8F5E9',    // light green background
  primaryBgMid: '#C8E6C9',

  // Accent
  accent: '#66BB6A',
  accentYellow: '#FFB300',
  accentRed: '#E53935',
  accentOrange: '#FF7043',

  // Neutrals
  white: '#FFFFFF',
  surface: '#F9FBF9',
  border: '#E0EDE0',
  divider: '#DCEDC8',

  // Text
  textPrimary: '#1B3A1C',
  textSecondary: '#5A7A5C',
  textMuted: '#9CB89E',
  textInverse: '#FFFFFF',

  // Status colours
  statusFresh: '#4CAF50',
  statusExpiringSoon: '#FFB300',
  statusExpired: '#E53935',

  // Tab bar
  tabActive: '#4CAF50',
  tabInactive: '#9CB89E',
  tabBg: '#FFFFFF',
} as const;

export const FontSizes = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const Radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
