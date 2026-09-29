import { describe, expect, it } from 'vitest';
import { createEmptyBoard, placeTiles } from '@scrabble/shared';
import { computeUnseenLetters } from './unseenLetters.js';

describe('computeUnseenLetters', () => {
  it('returns the full distribution on an empty board with no rack', () => {
    const unseen = computeUnseenLetters(createEmptyBoard(), []);
    expect(unseen.E).toBe(15);
    expect(unseen['*']).toBe(2);
    expect(Object.values(unseen).reduce((a, b) => a + b, 0)).toBe(102);
  });

  it('subtracts board tiles (a played blank counts as a blank) and the own rack', () => {
    const board = placeTiles(createEmptyBoard(), [
      { row: 7, col: 7, tile: { letter: 'E', isBlank: false, playedBy: 'p', turnNumber: 1 } },
      { row: 7, col: 8, tile: { letter: 'Z', isBlank: true, playedBy: 'p', turnNumber: 1 } },
    ]);
    const unseen = computeUnseenLetters(board, ['E', 'Z', '*']);
    expect(unseen.E).toBe(13);
    expect(unseen.Z).toBe(0);
    expect(unseen['*']).toBe(0);
  });
});
