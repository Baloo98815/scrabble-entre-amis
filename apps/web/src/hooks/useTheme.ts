import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'custom';
export type BaseTheme = 'light' | 'dark';

/** Ordre du cycle du bouton : clair → sombre → personnalisé → clair… */
const CYCLE: readonly Theme[] = ['light', 'dark', 'custom'];

/** Variables CSS modifiables dans la page Paramètres (les valeurs rgba ne sont pas éditables). */
export const CUSTOMIZABLE_COLORS: ReadonlyArray<{
  group: string;
  items: ReadonlyArray<{ key: string; label: string }>;
}> = [
  {
    group: 'Général',
    items: [
      { key: '--bg', label: 'Fond de page' },
      { key: '--panel', label: 'Cartes et panneaux' },
      { key: '--ink', label: 'Texte' },
      { key: '--muted', label: 'Texte secondaire' },
      { key: '--border', label: 'Bordures' },
      { key: '--accent', label: 'Accent (boutons)' },
      { key: '--accent-dark', label: 'Accent foncé (liens)' },
    ],
  },
  {
    group: 'Plateau',
    items: [
      { key: '--board-bg', label: 'Fond du plateau' },
      { key: '--cell-bg', label: 'Case vide' },
      { key: '--cell-center-bg', label: 'Case centrale' },
      { key: '--cell-over-bg', label: 'Case survolée' },
      { key: '--tw', label: 'Mot compte triple' },
      { key: '--tw-ink', label: 'Texte mot triple' },
      { key: '--dw', label: 'Mot compte double' },
      { key: '--tl', label: 'Lettre compte triple' },
      { key: '--dl', label: 'Lettre compte double' },
    ],
  },
  {
    group: 'Tuiles',
    items: [
      { key: '--tile-bg', label: 'Fond des tuiles' },
      { key: '--tile-border', label: 'Bordure des tuiles' },
      { key: '--tile-blank-bg', label: 'Tuile joker' },
    ],
  },
  {
    group: 'Joueurs et messages',
    items: [
      { key: '--player-active-bg', label: 'Joueur actif' },
      { key: '--status-online', label: 'Statut en ligne' },
      { key: '--status-offline', label: 'Statut hors ligne' },
      { key: '--banner-bg', label: 'Bandeau d’alerte (fond)' },
      { key: '--banner-border', label: 'Bandeau d’alerte (bordure)' },
      { key: '--banner-ink', label: 'Bandeau d’alerte (texte)' },
      { key: '--error', label: 'Erreur' },
      { key: '--success', label: 'Succès' },
    ],
  },
];

const ALL_KEYS = CUSTOMIZABLE_COLORS.flatMap((g) => g.items.map((i) => i.key));

const THEME_KEY = 'scrabble:theme';
const CUSTOM_KEY = 'scrabble:theme-custom';

type CustomColors = Record<string, string>;

interface CustomState {
  base: BaseTheme;
  colors: CustomColors;
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'custom' ? stored : null;
  } catch {
    return null;
  }
}

function readStoredCustom(): CustomState {
  const fallback: CustomState = { base: 'light', colors: {} };
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { base?: unknown; colors?: unknown };
    const base: BaseTheme = parsed.base === 'dark' ? 'dark' : 'light';
    const colors: CustomColors = {};
    if (parsed.colors && typeof parsed.colors === 'object') {
      for (const [key, value] of Object.entries(parsed.colors)) {
        if (ALL_KEYS.includes(key) && typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
          colors[key] = value;
        }
      }
    }
    return { base, colors };
  } catch {
    return fallback;
  }
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Convertit une valeur CSS calculée (`#abc`, `rgb(...)`) en `#rrggbb` pour <input type="color">. */
function toHex(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  const m = v.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  return '#000000';
}

/** Lit la palette CSS d'un thème de base en retirant temporairement les surcharges inline. */
function readBasePalette(base: BaseTheme): CustomColors {
  const root = document.documentElement;
  const previousTheme = root.getAttribute('data-theme');
  const saved = ALL_KEYS.map((key) => [key, root.style.getPropertyValue(key)] as const);
  for (const key of ALL_KEYS) root.style.removeProperty(key);
  root.setAttribute('data-theme', base);
  const computed = getComputedStyle(root);
  const palette: CustomColors = {};
  for (const key of ALL_KEYS) palette[key] = toHex(computed.getPropertyValue(key));
  if (previousTheme) root.setAttribute('data-theme', previousTheme);
  for (const [key, value] of saved) if (value) root.style.setProperty(key, value);
  return palette;
}

export interface ThemeValue {
  theme: Theme;
  /** Passe au thème suivant : clair → sombre → personnalisé → clair… */
  cycleTheme: () => void;
  customBase: BaseTheme;
  /** Couleurs effectives du thème personnalisé (surcharges par-dessus la palette de base). */
  customColors: CustomColors;
  setCustomColor: (key: string, value: string) => void;
  /** Change la palette de départ et efface les surcharges. */
  setCustomBase: (base: BaseTheme) => void;
  resetCustom: () => void;
}

/** Thème courant + thème personnalisé, persistés dans localStorage (best-effort). */
export function useTheme(): ThemeValue {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? (prefersDark() ? 'dark' : 'light'));
  const [custom, setCustom] = useState<CustomState>(readStoredCustom);
  const [basePalette, setBasePalette] = useState<CustomColors>({});

  useEffect(() => {
    const root = document.documentElement;
    const resolvedBase: BaseTheme = theme === 'custom' ? custom.base : theme;
    root.setAttribute('data-theme', resolvedBase);
    for (const key of ALL_KEYS) root.style.removeProperty(key);
    if (theme === 'custom') {
      for (const [key, value] of Object.entries(custom.colors)) root.style.setProperty(key, value);
    }
    // Palette de base lue une fois les surcharges appliquées/retirées, pour afficher les valeurs par défaut.
    setBasePalette(readBasePalette(custom.base));
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    } catch {
      // best-effort : pas de persistance si localStorage est indisponible
    }
  }, [theme, custom]);

  const cycleTheme = useCallback(() => {
    setTheme((current) => CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] ?? 'light');
  }, []);

  const setCustomColor = useCallback((key: string, value: string) => {
    if (!ALL_KEYS.includes(key) || !/^#[0-9a-fA-F]{6}$/.test(value)) return;
    setCustom((c) => ({ ...c, colors: { ...c.colors, [key]: value } }));
  }, []);

  const setCustomBase = useCallback((base: BaseTheme) => {
    setCustom({ base, colors: {} });
  }, []);

  const resetCustom = useCallback(() => {
    setCustom((c) => ({ ...c, colors: {} }));
  }, []);

  return {
    theme,
    cycleTheme,
    customBase: custom.base,
    customColors: { ...basePalette, ...custom.colors },
    setCustomColor,
    setCustomBase,
    resetCustom,
  };
}
