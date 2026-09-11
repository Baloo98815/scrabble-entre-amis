import { useThemeContext } from '../state/ThemeContext.js';

/** Bouton flottant présent sur toutes les pages pour basculer entre thème clair et sombre. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeContext();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
