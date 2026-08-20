import { describe, expect, it } from 'vitest';
import { extractWordsFromTsv, normalizeAndFilter } from './normalize.js';

describe('extractWordsFromTsv', () => {
  it('extracts the "ortho" column from a Lexique383-like TSV export', () => {
    const tsv = ['ortho\tphon\tlemme', 'chat\tSa\tchat', "aujourd'hui\tOZuRdHi\taujourd'hui", 'chat\tSa\tchat'].join(
      '\n',
    );
    expect(extractWordsFromTsv(tsv)).toEqual(['AUJOURDHUI', 'CHAT']);
  });

  it('falls back to one word per line when there is no "ortho" header', () => {
    const content = ['chat', 'chien', 'chat'].join('\n');
    expect(extractWordsFromTsv(content)).toEqual(['CHAT', 'CHIEN']);
  });

  it('returns an empty list for an empty file', () => {
    expect(extractWordsFromTsv('')).toEqual([]);
  });
});

describe('normalizeAndFilter', () => {
  it('deduplicates and sorts normalized words', () => {
    expect(normalizeAndFilter(['chat', 'CHAT', 'chien'])).toEqual(['CHAT', 'CHIEN']);
  });

  it('excludes words longer than 15 letters or empty after normalization', () => {
    const tooLong = 'a'.repeat(16);
    expect(normalizeAndFilter([tooLong, '123', 'chat'])).toEqual(['CHAT']);
  });

  it('keeps valid one-letter words (e.g. "y", "a")', () => {
    expect(normalizeAndFilter(['y', 'a'])).toEqual(['A', 'Y']);
  });
});
