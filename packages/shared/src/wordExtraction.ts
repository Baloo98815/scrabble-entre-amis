import type { Board, Letter, Placement, TileOnBoard } from './types.js';
import { getCell, isInBounds, placeTiles } from './board.js';

export interface ExtractedWordCell {
  row: number;
  col: number;
  letter: Letter;
  isBlank: boolean;
  isNew: boolean;
}

export interface ExtractedWord {
  word: string;
  cells: ExtractedWordCell[];
}

function extractWordAt(
  boardAfter: Board,
  row: number,
  col: number,
  axis: 'row' | 'col',
  newKeys: Set<string>,
): ExtractedWord | null {
  let startRow = row;
  let startCol = col;
  if (axis === 'row') {
    while (isInBounds(startRow, startCol - 1) && getCell(boardAfter, startRow, startCol - 1) !== null) {
      startCol--;
    }
  } else {
    while (isInBounds(startRow - 1, startCol) && getCell(boardAfter, startRow - 1, startCol) !== null) {
      startRow--;
    }
  }

  const cells: ExtractedWordCell[] = [];
  let word = '';
  let r = startRow;
  let c = startCol;
  while (isInBounds(r, c)) {
    const tile = getCell(boardAfter, r, c);
    if (tile === null) break;
    word += tile.letter;
    cells.push({ row: r, col: c, letter: tile.letter, isBlank: tile.isBlank, isNew: newKeys.has(`${r},${c}`) });
    if (axis === 'row') c++;
    else r++;
  }

  if (word.length < 2) return null;
  return { word, cells };
}

function wordKey(word: ExtractedWord): string {
  return word.cells.map((c) => `${c.row},${c.col}`).join('|');
}

/**
 * Détermine tous les mots formés par un coup (mot principal + mots transversaux),
 * à partir du plateau AVANT le coup et des tuiles nouvellement posées.
 */
export function extractWordsFormed(board: Board, placements: Placement[]): ExtractedWord[] {
  const newKeys = new Set(placements.map((p) => `${p.row},${p.col}`));
  const tiles: Array<{ row: number; col: number; tile: TileOnBoard }> = placements.map((p) => ({
    row: p.row,
    col: p.col,
    tile: { letter: p.letter, isBlank: p.isBlank, playedBy: '', turnNumber: 0 },
  }));
  const boardAfter = placeTiles(board, tiles);

  const results: ExtractedWord[] = [];
  const seen = new Set<string>();
  const push = (word: ExtractedWord | null) => {
    if (!word) return;
    const key = wordKey(word);
    if (seen.has(key)) return;
    seen.add(key);
    results.push(word);
  };

  if (placements.length === 1) {
    const p = placements[0]!;
    const horizontal = extractWordAt(boardAfter, p.row, p.col, 'row', newKeys);
    const vertical = extractWordAt(boardAfter, p.row, p.col, 'col', newKeys);
    if (!horizontal && !vertical) {
      // Lettre isolée (uniquement possible au tout premier coup de la partie) : le mot
      // formé est la lettre elle-même.
      const tile = getCell(boardAfter, p.row, p.col)!;
      push({
        word: tile.letter,
        cells: [{ row: p.row, col: p.col, letter: tile.letter, isBlank: tile.isBlank, isNew: true }],
      });
    } else {
      push(horizontal);
      push(vertical);
    }
    return results;
  }

  const rows = new Set(placements.map((p) => p.row));
  const mainAxis: 'row' | 'col' = rows.size === 1 ? 'row' : 'col';
  const anyPlacement = placements[0]!;
  push(extractWordAt(boardAfter, anyPlacement.row, anyPlacement.col, mainAxis, newKeys));

  const crossAxis: 'row' | 'col' = mainAxis === 'row' ? 'col' : 'row';
  for (const p of placements) {
    push(extractWordAt(boardAfter, p.row, p.col, crossAxis, newKeys));
  }

  return results;
}
