import { createContext, useContext, type ReactNode } from 'react';
import { useTheme, type Theme } from '../hooks/useTheme.js';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext doit être utilisé à l’intérieur de <ThemeProvider>.');
  return ctx;
}
