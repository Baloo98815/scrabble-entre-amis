import { createContext, useContext, type ReactNode } from 'react';
import { useTheme, type ThemeValue } from '../hooks/useTheme.js';

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext doit être utilisé à l’intérieur de <ThemeProvider>.');
  return ctx;
}
