import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, BONUS_GRID, CENTER, createEmptyBoard, getBonus, getCell, isCenterCell, placeTiles } from './board.js';

describe('board bonus layout', () => {
  it('is a 15x15 grid', () => {
    expect(BONUS_GRID.length).toBe(BOARD_SIZE);
    for (const row of BONUS_GRID) expect(row.length).toBe(BOARD_SIZE);
  });

  it('has the official count of bonus cells', () => {
    const flat = BONUS_GRID.flat();
    expect(flat.filter((c) => c.type === 'TW').length).toBe(8);
    expect(flat.filter((c) => c.type === 'DW').length).toBe(17); // dont le centre
    expect(flat.filter((c) => c.type === 'TL').length).toBe(12);
    expect(flat.filter((c) => c.type === 'DL').length).toBe(24);
  });

  it('marks the center cell as a double word and as the center', () => {
    expect(isCenterCell(CENTER, CENTER)).toBe(true);
    expect(getBonus(CENTER, CENTER).type).toBe('DW');
  });

  it('the four corners are triple word', () => {
    for (const [r, c] of [
      [0, 0],
      [0, 14],
      [14, 0],
      [14, 14],
    ] as const) {
      expect(getBonus(r, c).type).toBe('TW');
    }
  });

  it('is symmetric across both diagonals', () => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(getBonus(r, c).type).toBe(getBonus(c, r).type);
        expect(getBonus(r, c).type).toBe(getBonus(BOARD_SIZE - 1 - r, BOARD_SIZE - 1 - c).type);
      }
    }
  });

  it('throws when reading out of bounds', () => {
    expect(() => getBonus(-1, 0)).toThrow();
    expect(() => getBonus(0, 15)).toThrow();
  });
});

describe('placeTiles', () => {
  it('does not mutate the original board', () => {
    const board = createEmptyBoard();
    const tile = { letter: 'A', isBlank: false, playedBy: 'p1', turnNumber: 0 };
    const next = placeTiles(board, [{ row: 7, col: 7, tile }]);

    expect(getCell(board, 7, 7)).toBeNull();
    expect(getCell(next, 7, 7)).toEqual(tile);
  });

  it('throws when placing out of bounds', () => {
    const board = createEmptyBoard();
    const tile = { letter: 'A', isBlank: false, playedBy: 'p1', turnNumber: 0 };
    expect(() => placeTiles(board, [{ row: 20, col: 0, tile }])).toThrow();
  });
});
