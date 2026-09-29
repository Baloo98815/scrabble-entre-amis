import { useThemeContext } from '../state/ThemeContext.js';

const LABELS = {
  light: { icon: '☀️', current: 'clair', next: 'sombre' },
  dark: { icon: '🌙', current: 'sombre', next: 'personnalisé' },
  custom: { icon: '🎨', current: 'personnalisé', next: 'clair' },
} as const;

/** Bouton flottant présent sur toutes les pages : clair → sombre → personnalisé → clair… */
export function ThemeToggle() {
  const { theme, cycleTheme } = useThemeContext();
  const { icon, current, next } = LABELS[theme];
  const label = `Thème ${current} — passer au thème ${next}`;
  return (
    <button type="button" className="theme-toggle" onClick={cycleTheme} aria-label={label} title={label}>
      {icon}
    </button>
  );
}
