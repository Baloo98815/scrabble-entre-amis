import type { Board, BoardCell, TileOnBoard } from './types.js';

export const BOARD_SIZE = 15;
export const CENTER = 7;

export type BonusType = 'TW' | 'DW' | 'TL' | 'DL' | null;

export interface BonusCell {
  type: BonusType;
  isCenter: boolean;
}

/**
 * Disposition standard du plateau de Scrabble (identique en français et en anglais).
 * t = mot x3, d = mot x2, c = mot x2 (case centrale), T = lettre x3, D = lettre x2, . = normale.
 * 8 cases mot x3, 17 cases mot x2 (dont le centre), 12 cases lettre x3, 24 cases lettre x2.
 */
const ROW_PATTERNS: string[] = [
  't..D...t...D..t',
  '.d...T...T...d.',
  '..d...D.D...d..',
  'D..d...D...d..D',
  '....d.....d....',
  '.T...T...T...T.',
  '..D...D.D...D..',
  't..D...c...D..t',
  '..D...D.D...D..',
  '.T...T...T...T.',
  '....d.....d....',
  'D..d...D...d..D',
  '..d...D.D...d..',
  '.d...T...T...d.',
  't..D...t...D..t',
];

function buildBonusGrid(): BonusCell[][] {
  return ROW_PATTERNS.map((row) =>
    row.split('').map((char): BonusCell => {
      switch (char) {
        case 't':
          return { type: 'TW', isCenter: false };
        case 'd':
          return { type: 'DW', isCenter: false };
        case 'c':
          return { type: 'DW', isCenter: true };
        case 'T':
          return { type: 'TL', isCenter: false };
        case 'D':
          return { type: 'DL', isCenter: false };
        default:
          return { type: null, isCenter: false };
      }
    }),
  );
}

export const BONUS_GRID: BonusCell[][] = buildBonusGrid();

export function getBonus(row: number, col: number): BonusCell {
  const cell = BONUS_GRID[row]?.[col];
  if (!cell) throw new Error(`Case hors plateau: (${row}, ${col})`);
  return cell;
}

export function isCenterCell(row: number, col: number): boolean {
  return getBonus(row, col).isCenter;
}

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function createEmptyBoard(): Board {
  const cells: BoardCell[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
  return { cells };
}

export function getCell(board: Board, row: number, col: number): BoardCell {
  const cell = board.cells[row]?.[col];
  return cell ?? null;
}

/** Retourne un nouveau plateau avec les tuiles ajoutées (ne mute pas `board`). */
export function placeTiles(
  board: Board,
  tiles: Array<{ row: number; col: number; tile: TileOnBoard }>,
): Board {
  const cells = board.cells.map((row) => [...row]);
  for (const { row, col, tile } of tiles) {
    const boardRow = cells[row];
    if (!boardRow || !isInBounds(row, col)) {
      throw new Error(`Case hors plateau: (${row}, ${col})`);
    }
    boardRow[col] = tile;
  }
  return { cells };
}
