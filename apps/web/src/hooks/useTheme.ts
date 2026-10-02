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
const SAVED_KEY = 'scrabble:themes';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

type CustomColors = Record<string, string>;

export interface SavedTheme extends CustomState {
  name: string;
}

export interface CustomState {
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

/** Valide un objet quelconque (localStorage, fichier importé) en `CustomState` ; `null` si inexploitable. */
export function sanitizeCustom(parsed: unknown): CustomState | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const { base: rawBase, colors: rawColors } = parsed as { base?: unknown; colors?: unknown };
  if (rawColors !== undefined && (rawColors === null || typeof rawColors !== 'object')) return null;
  const colors: CustomColors = {};
  for (const [key, value] of Object.entries(rawColors ?? {})) {
    if (ALL_KEYS.includes(key) && typeof value === 'string' && HEX_COLOR.test(value)) {
      colors[key] = value.toLowerCase();
    }
  }
  return { base: rawBase === 'dark' ? 'dark' : 'light', colors };
}

function readStoredCustom(): CustomState {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return (raw && sanitizeCustom(JSON.parse(raw))) || { base: 'light', colors: {} };
  } catch {
    return { base: 'light', colors: {} };
  }
}

function readStoredThemes(): SavedTheme[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      const name = (item as { name?: unknown } | null)?.name;
      const custom = sanitizeCustom(item);
      return typeof name === 'string' && name.trim() && custom
        ? [{ name: name.trim(), ...custom }]
        : [];
    });
  } catch {
    return [];
  }
}

const THEME_FILE_FORMAT = 'scrabble-theme';

/** Sérialise un thème en JSON portable (palette complète, pour qu'il ne dépende pas des défauts de l'appli). */
export function serializeTheme(theme: {
  name?: string;
  base: BaseTheme;
  colors: CustomColors;
}): string {
  return JSON.stringify({ format: THEME_FILE_FORMAT, version: 1, ...theme }, null, 2);
}

/** Parse un JSON de thème exporté ; lève une `Error` au message lisible si le contenu est invalide. */
export function parseThemeJson(text: string): { name?: string } & CustomState {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Ce n’est pas un JSON valide.');
  }
  const custom = sanitizeCustom(data);
  if (!custom || (data as { format?: unknown }).format !== THEME_FILE_FORMAT) {
    throw new Error('Ce fichier n’est pas un thème Scrabble.');
  }
  if (Object.keys(custom.colors).length === 0)
    throw new Error('Aucune couleur reconnue dans ce thème.');
  const name = (data as { name?: unknown }).name;
  return {
    ...custom,
    ...(typeof name === 'string' && name.trim() ? { name: name.trim().slice(0, 40) } : {}),
  };
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
  if (/^#[0-9a-fA-F]{3}$/.test(v))
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  const m = v.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m)
    return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
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
  savedThemes: SavedTheme[];
  /** Enregistre le thème personnalisé courant sous ce nom (remplace un thème du même nom). */
  saveTheme: (name: string) => void;
  /** Applique un thème enregistré comme thème personnalisé et l'active. */
  loadTheme: (name: string) => void;
  deleteTheme: (name: string) => void;
  /** Remplace le thème personnalisé par un thème importé et l'active. */
  applyImported: (imported: CustomState) => void;
}

/** Thème courant + thème personnalisé, persistés dans localStorage (best-effort). */
export function useTheme(): ThemeValue {
  const [theme, setTheme] = useState<Theme>(
    () => readStoredTheme() ?? (prefersDark() ? 'dark' : 'light'),
  );
  const [custom, setCustom] = useState<CustomState>(readStoredCustom);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(readStoredThemes);
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

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedThemes));
    } catch {
      // best-effort
    }
  }, [savedThemes]);

  const cycleTheme = useCallback(() => {
    setTheme((current) => CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] ?? 'light');
  }, []);

  const setCustomColor = useCallback((key: string, value: string) => {
    if (!ALL_KEYS.includes(key) || !HEX_COLOR.test(value)) return;
    setCustom((c) => ({ ...c, colors: { ...c.colors, [key]: value } }));
  }, []);

  const setCustomBase = useCallback((base: BaseTheme) => {
    setCustom({ base, colors: {} });
  }, []);

  const resetCustom = useCallback(() => {
    setCustom((c) => ({ ...c, colors: {} }));
  }, []);

  const saveTheme = useCallback(
    (name: string) => {
      const trimmed = name.trim().slice(0, 40);
      if (!trimmed) return;
      setSavedThemes((list) => [
        ...list.filter((t) => t.name !== trimmed),
        { name: trimmed, ...custom },
      ]);
    },
    [custom],
  );

  const applyImported = useCallback((imported: CustomState) => {
    setCustom({ base: imported.base, colors: imported.colors });
    setTheme('custom');
  }, []);

  const loadTheme = useCallback(
    (name: string) => {
      const found = savedThemes.find((t) => t.name === name);
      if (found) applyImported(found);
    },
    [savedThemes, applyImported],
  );

  const deleteTheme = useCallback((name: string) => {
    setSavedThemes((list) => list.filter((t) => t.name !== name));
  }, []);

  return {
    theme,
    cycleTheme,
    customBase: custom.base,
    customColors: { ...basePalette, ...custom.colors },
    setCustomColor,
    setCustomBase,
    resetCustom,
    savedThemes,
    saveTheme,
    loadTheme,
    deleteTheme,
    applyImported,
  };
}
