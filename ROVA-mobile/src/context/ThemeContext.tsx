import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

type ThemeColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  bg: string;
  bgCard: string;
  bgElevated: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  successBg: string;
  danger: string;
  dangerBg: string;
  warning: string;
  warningBg: string;
  info: string;
  infoBg: string;
  border: string;
  borderLight: string;
  white: string;
  black: string;
};

const lightColors: ThemeColors = {
  primary: '#9333ea',
  primaryDark: '#7C3AED',
  primaryLight: 'rgba(147, 51, 234, 0.15)',
  accent: '#a855f7',
  bg: '#f4f4f5',
  bgCard: '#ffffff',
  bgElevated: '#ffffff',
  bgInput: '#ffffff',
  textPrimary: '#09090b',
  textSecondary: '#3f3f46',
  textMuted: '#71717a',
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.12)',
  danger: '#ef4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.12)',
  border: '#d4d4d8',
  borderLight: '#e4e4e7',
  white: '#ffffff',
  black: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#9333ea',
  primaryDark: '#7C3AED',
  primaryLight: 'rgba(147, 51, 234, 0.15)',
  accent: '#a855f7',
  bg: '#09090b',
  bgCard: '#1c1c1f',
  bgElevated: '#18181b',
  bgInput: '#18181b',
  textPrimary: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.12)',
  danger: '#ef4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.12)',
  border: '#27272a',
  borderLight: '#27272a',
  white: '#ffffff',
  black: '#000000',
};

type ThemeContextType = {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  const toggleTheme = () => setIsDark(prev => !prev);
  const setTheme = (dark: boolean) => setIsDark(dark);

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
