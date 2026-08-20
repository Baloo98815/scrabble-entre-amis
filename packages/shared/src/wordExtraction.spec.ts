import { describe, expect, it } from 'vitest';
import { CENTER, createEmptyBoard, placeTiles } from './board.js';
import { extractWordsFormed } from './wordExtraction.js';
import type { Placement } from './types.js';

function tile(letter: string) {
  return { letter, isBlank: false, playedBy: 'p1', turnNumber: 0 };
}

describe('extractWordsFormed', () => {
  it('extracts a single isolated word for the very first move', () => {
    const board = createEmptyBoard();
    const placements: Placement[] = [
      { row: CENTER, col: CENTER - 1, letter: 'C', isBlank: false },
      { row: CENTER, col: CENTER, letter: 'A', isBlank: false },
      { row: CENTER, col: CENTER + 1, letter: 'T', isBlank: false },
    ];
    const words = extractWordsFormed(board, placements);
    expect(words).toHaveLength(1);
    expect(words[0]!.word).toBe('CAT');
  });

  it('extracts main word plus a single crossword formed by one new tile', () => {
    const board = placeTiles(createEmptyBoard(), [
      { row: CENTER, col: CENTER - 1, tile: tile('C') },
      { row: CENTER, col: CENTER, tile: tile('A') },
      { row: CENTER, col: CENTER + 1, tile: tile('T') },
    ]);
    // Ajoute "OP" verticalement à partir du T existant (CENTER, CENTER+1).
    const placements: Placement[] = [{ row: CENTER + 1, col: CENTER + 1, letter: 'O', isBlank: false }];
    const words = extractWordsFormed(board, placements);
    const texts = words.map((w) => w.word).sort();
    expect(texts).toEqual(['TO']);
  });

  it('extracts multiple crosswords for a multi-letter placement', () => {
    // Plateau : "CAT" horizontal, puis on pose "S" sous le C et sous le T pour former
    // deux mots transversaux en plus du mot principal.
    const board = placeTiles(createEmptyBoard(), [
      { row: CENTER, col: CENTER - 1, tile: tile('C') },
      { row: CENTER, col: CENTER, tile: tile('A') },
      { row: CENTER, col: CENTER + 1, tile: tile('T') },
      { row: CENTER + 1, col: CENTER - 1, tile: tile('O') },
      { row: CENTER + 1, col: CENTER + 1, tile: tile('O') },
    ]);
    const placements: Placement[] = [
      { row: CENTER + 2, col: CENTER - 1, letter: 'W', isBlank: false },
      { row: CENTER + 2, col: CENTER, letter: 'A', isBlank: false },
      { row: CENTER + 2, col: CENTER + 1, letter: 'X', isBlank: false },
    ];
    const words = extractWordsFormed(board, placements);
    const texts = words.map((w) => w.word).sort();
    expect(texts).toEqual(['COW', 'TOX', 'WAX']);
  });

  it('marks only the newly placed cells as isNew', () => {
    const board = placeTiles(createEmptyBoard(), [
      { row: CENTER, col: CENTER - 1, tile: tile('C') },
      { row: CENTER, col: CENTER, tile: tile('A') },
      { row: CENTER, col: CENTER + 1, tile: tile('T') },
    ]);
    const placements: Placement[] = [{ row: CENTER + 1, col: CENTER + 1, letter: 'O', isBlank: false }];
    const [word] = extractWordsFormed(board, placements);
    const existingCell = word!.cells.find((c) => c.row === CENTER && c.col === CENTER + 1);
    const newCell = word!.cells.find((c) => c.row === CENTER + 1 && c.col === CENTER + 1);
    expect(existingCell?.isNew).toBe(false);
    expect(newCell?.isNew).toBe(true);
  });
});
