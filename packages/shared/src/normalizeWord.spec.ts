import { describe, expect, it } from 'vitest';
import { normalizeWord } from './normalizeWord.js';

describe('normalizeWord', () => {
  it('uppercases the word', () => {
    expect(normalizeWord('chat')).toBe('CHAT');
  });

  it('strips accents', () => {
    expect(normalizeWord('éléphant')).toBe('ELEPHANT');
    expect(normalizeWord('garçon')).toBe('GARCON');
    expect(normalizeWord('forêt')).toBe('FORET');
    expect(normalizeWord('œuf')).toBe('OEUF');
  });

  it('strips apostrophes and hyphens', () => {
    expect(normalizeWord("aujourd'hui")).toBe('AUJOURDHUI');
    expect(normalizeWord('porte-bonheur')).toBe('PORTEBONHEUR');
  });

  it('strips anything that is not a letter after normalization', () => {
    expect(normalizeWord('mot123')).toBe('MOT');
  });
});
