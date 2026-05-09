export const colors = {
  // Brand (from web app)
  primary: '#8B5CF6',
  primaryDark: '#7C3AED',
  primaryLight: '#EDE9FE',
  accent: '#00D4AA',
  accentLight: '#E0FBF5',

  // Backgrounds (Light mode to match screenshot)
  bg: '#F9FAFB', // Off-white app background
  bgCard: '#FFFFFF', // Pure white for cards and inputs
  bgElevated: '#FFFFFF',
  bgInput: '#FFFFFF', // Pure white inputs

  // Text
  textPrimary: '#111827', // Very dark gray, almost black
  textSecondary: '#4B5563', // Medium gray
  textMuted: '#9CA3AF', // Light gray for placeholders

  // Status
  success: '#10B981',
  successBg: '#D1FAE5',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  info: '#3B82F6',
  infoBg: '#DBEAFE',

  // Borders
  border: '#E5E7EB', // Soft gray border for cards
  borderLight: '#F3F4F6',

  // White shades
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
};
