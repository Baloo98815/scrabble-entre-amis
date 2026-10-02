import { describe, expect, it } from 'vitest';
import { parseThemeJson, sanitizeCustom, serializeTheme } from './useTheme.js';

describe('thème exportable', () => {
  it('fait un aller-retour export → import', () => {
    const json = serializeTheme({
      name: 'Nuit',
      base: 'dark',
      colors: { '--bg': '#112233', '--ink': '#FFFFFF' },
    });
    expect(parseThemeJson(json)).toEqual({
      name: 'Nuit',
      base: 'dark',
      colors: { '--bg': '#112233', '--ink': '#ffffff' },
    });
  });

  it('ignore les clés inconnues et les couleurs invalides', () => {
    const json = JSON.stringify({
      format: 'scrabble-theme',
      base: 'light',
      colors: { '--bg': '#123456', '--nope': '#000000', '--ink': 'red' },
    });
    expect(parseThemeJson(json).colors).toEqual({ '--bg': '#123456' });
  });

  it('rejette un JSON invalide, un autre format ou un thème vide', () => {
    expect(() => parseThemeJson('pas du json')).toThrow('JSON valide');
    expect(() => parseThemeJson('{"base":"dark","colors":{"--bg":"#000000"}}')).toThrow(
      'pas un thème',
    );
    expect(() => parseThemeJson('{"format":"scrabble-theme","colors":{}}')).toThrow(
      'Aucune couleur',
    );
  });

  it('sanitizeCustom renvoie null pour une valeur non objet', () => {
    expect(sanitizeCustom('x')).toBeNull();
  });
});
