import { describe, expect, it } from 'vitest';
import { CENTER, createEmptyBoard, placeTiles } from './board.js';
import { InvalidMoveError, validatePlacement } from './placement.js';
import type { Placement } from './types.js';

function tile(letter: string) {
  return { letter, isBlank: false, playedBy: 'p1', turnNumber: 0 };
}

describe('validatePlacement — premier coup', () => {
  it('accepts a word covering the center cell', () => {
    const board = createEmptyBoard();
    const placements: Placement[] = [
      { row: CENTER, col: CENTER - 1, letter: 'C', isBlank: false },
      { row: CENTER, col: CENTER, letter: 'A', isBlank: false },
      { row: CENTER, col: CENTER + 1, letter: 'T', isBlank: false },
    ];
    expect(() => validatePlacement(board, placements, true)).not.toThrow();
  });

  it('rejects a first word that does not cover the center', () => {
    const board = createEmptyBoard();
    const placements: Placement[] = [
      { row: 0, col: 0, letter: 'C', isBlank: false },
      { row: 0, col: 1, letter: 'A', isBlank: false },
    ];
    expect(() => validatePlacement(board, placements, true)).toThrow(InvalidMoveError);
  });
});

describe('validatePlacement — coups suivants', () => {
  function boardWithCat() {
    const empty = createEmptyBoard();
    return placeTiles(empty, [
      { row: CENTER, col: CENTER - 1, tile: tile('C') },
      { row: CENTER, col: CENTER, tile: tile('A') },
      { row: CENTER, col: CENTER + 1, tile: tile('T') },
    ]);
  }

  it('rejects a word disconnected from existing tiles', () => {
    const board = boardWithCat();
    const placements: Placement[] = [
      { row: 0, col: 0, letter: 'D', isBlank: false },
      { row: 0, col: 1, letter: 'O', isBlank: false },
    ];
    expect(() => validatePlacement(board, placements, false)).toThrow(InvalidMoveError);
  });

  it('accepts a word connected to an existing tile', () => {
    const board = boardWithCat();
    const placements: Placement[] = [
      { row: CENTER + 1, col: CENTER + 1, letter: 'O', isBlank: false },
      { row: CENTER + 2, col: CENTER + 1, letter: 'P', isBlank: false },
    ];
    expect(() => validatePlacement(board, placements, false)).not.toThrow();
  });

  it('rejects placements on an already occupied cell', () => {
    const board = boardWithCat();
    const placements: Placement[] = [{ row: CENTER, col: CENTER, letter: 'A', isBlank: false }];
    expect(() => validatePlacement(board, placements, false)).toThrow(InvalidMoveError);
  });

  it('rejects placements not aligned on a single row or column', () => {
    const board = boardWithCat();
    const placements: Placement[] = [
      { row: CENTER + 1, col: CENTER + 1, letter: 'O', isBlank: false },
      { row: CENTER + 2, col: CENTER + 2, letter: 'P', isBlank: false },
    ];
    expect(() => validatePlacement(board, placements, false)).toThrow(InvalidMoveError);
  });

  it('rejects a gap left in the middle of a placed word', () => {
    const board = createEmptyBoard();
    const placements: Placement[] = [
      { row: CENTER, col: CENTER - 1, letter: 'C', isBlank: false },
      { row: CENTER, col: CENTER + 1, letter: 'T', isBlank: false },
    ];
    expect(() => validatePlacement(board, placements, true)).toThrow(InvalidMoveError);
  });

  it('rejects duplicate cells in the same move', () => {
    const board = createEmptyBoard();
    const placements: Placement[] = [
      { row: CENTER, col: CENTER, letter: 'A', isBlank: false },
      { row: CENTER, col: CENTER, letter: 'B', isBlank: false },
    ];
    expect(() => validatePlacement(board, placements, true)).toThrow(InvalidMoveError);
  });
});
