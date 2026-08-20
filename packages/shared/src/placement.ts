import type { Board, Placement } from './types.js';
import { CENTER, getCell, isInBounds } from './board.js';

export class InvalidMoveError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'InvalidMoveError';
  }
}

export interface PlacementValidationResult {
  direction: 'horizontal' | 'vertical';
}

/**
 * Valide qu'un ensemble de tuiles nouvellement posées forme un coup légal :
 * cases dans le plateau et libres, alignement sur une seule ligne/colonne, contiguïté
 * (en tenant compte des tuiles déjà présentes), recouvrement obligatoire du centre pour
 * le premier coup, connexion obligatoire à une tuile existante sinon.
 */
export function validatePlacement(
  board: Board,
  placements: Placement[],
  isFirstMove: boolean,
): PlacementValidationResult {
  if (placements.length === 0) {
    throw new InvalidMoveError('EMPTY_PLACEMENT', 'Aucune lettre posée.');
  }

  const newKeys = new Set<string>();
  for (const p of placements) {
    if (!isInBounds(p.row, p.col)) {
      throw new InvalidMoveError('OUT_OF_BOUNDS', `Case hors plateau: (${p.row}, ${p.col})`);
    }
    const key = `${p.row},${p.col}`;
    if (newKeys.has(key)) {
      throw new InvalidMoveError('DUPLICATE_CELL', `Case utilisée deux fois: (${p.row}, ${p.col})`);
    }
    newKeys.add(key);
    if (getCell(board, p.row, p.col) !== null) {
      throw new InvalidMoveError('CELL_OCCUPIED', `Case déjà occupée: (${p.row}, ${p.col})`);
    }
  }

  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.col));

  let direction: 'horizontal' | 'vertical';
  if (placements.length === 1) {
    direction = 'horizontal';
  } else if (rows.size === 1) {
    direction = 'horizontal';
  } else if (cols.size === 1) {
    direction = 'vertical';
  } else {
    throw new InvalidMoveError(
      'NOT_ALIGNED',
      'Les lettres doivent être alignées sur une seule ligne ou colonne.',
    );
  }

  const sorted = [...placements].sort((a, b) =>
    direction === 'horizontal' ? a.col - b.col : a.row - b.row,
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (direction === 'horizontal') {
    for (let c = first.col; c <= last.col; c++) {
      const isNew = newKeys.has(`${first.row},${c}`);
      if (!isNew && getCell(board, first.row, c) === null) {
        throw new InvalidMoveError('GAP_IN_WORD', 'Les lettres posées doivent former un mot continu.');
      }
    }
  } else {
    for (let r = first.row; r <= last.row; r++) {
      const isNew = newKeys.has(`${r},${first.col}`);
      if (!isNew && getCell(board, r, first.col) === null) {
        throw new InvalidMoveError('GAP_IN_WORD', 'Les lettres posées doivent former un mot continu.');
      }
    }
  }

  if (isFirstMove) {
    const coversCenter = placements.some((p) => p.row === CENTER && p.col === CENTER);
    if (!coversCenter) {
      throw new InvalidMoveError('MUST_COVER_CENTER', 'Le premier mot doit recouvrir la case centrale.');
    }
  } else {
    const touchesExisting = placements.some((p) => hasAdjacentTile(board, p.row, p.col));
    if (!touchesExisting) {
      throw new InvalidMoveError(
        'NOT_CONNECTED',
        'Le mot doit se connecter à au moins une lettre déjà posée sur le plateau.',
      );
    }
  }

  return { direction };
}

function hasAdjacentTile(board: Board, row: number, col: number): boolean {
  const neighbors: Array<[number, number]> = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
  return neighbors.some(([r, c]) => isInBounds(r, c) && getCell(board, r, c) !== null);
}
