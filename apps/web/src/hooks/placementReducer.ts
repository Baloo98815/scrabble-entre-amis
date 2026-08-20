import type { Placement } from '@scrabble/shared';

const BOARD_SIZE = 15;

export type Direction = 'horizontal' | 'vertical';

export interface PlacementState {
  selected: { row: number; col: number } | null;
  direction: Direction;
  /** Lettres posées ce tour-ci, pas encore soumises au serveur. */
  pending: Placement[];
  /** Cases déjà occupées par une tuile confirmée sur le plateau (hors `pending`). */
  occupied: ReadonlySet<string>;
}

export type PlacementAction =
  | { type: 'SET_OCCUPIED'; occupied: ReadonlySet<string> }
  | { type: 'SELECT_CELL'; row: number; col: number }
  | { type: 'PLACE_LETTER'; letter: string; isBlank: boolean }
  | { type: 'PLACE_LETTER_AT'; row: number; col: number; letter: string; isBlank: boolean }
  | { type: 'REMOVE_AT'; row: number; col: number }
  | { type: 'BACKSPACE' }
  | { type: 'CLEAR' };

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function isPendingAt(pending: Placement[], row: number, col: number): boolean {
  return pending.some((p) => p.row === row && p.col === col);
}

function isSelectable(state: PlacementState, row: number, col: number): boolean {
  if (!inBounds(row, col)) return false;
  if (isPendingAt(state.pending, row, col)) return true;
  return !state.occupied.has(key(row, col));
}

/** Prochaine case sélectionnable dans la direction courante, en sautant les tuiles déjà confirmées. */
function nextCell(state: PlacementState, row: number, col: number): { row: number; col: number } | null {
  const [dRow, dCol] = state.direction === 'horizontal' ? [0, 1] : [1, 0];
  let r = row + dRow;
  let c = col + dCol;
  while (inBounds(r, c) && state.occupied.has(key(r, c)) && !isPendingAt(state.pending, r, c)) {
    r += dRow;
    c += dCol;
  }
  return inBounds(r, c) ? { row: r, col: c } : null;
}

export function createInitialPlacementState(): PlacementState {
  return { selected: null, direction: 'horizontal', pending: [], occupied: new Set() };
}

export function placementReducer(state: PlacementState, action: PlacementAction): PlacementState {
  switch (action.type) {
    case 'SET_OCCUPIED':
      return { ...state, occupied: action.occupied };

    case 'SELECT_CELL': {
      if (!isSelectable(state, action.row, action.col)) return state;
      if (state.selected && state.selected.row === action.row && state.selected.col === action.col) {
        return { ...state, direction: state.direction === 'horizontal' ? 'vertical' : 'horizontal' };
      }
      return { ...state, selected: { row: action.row, col: action.col } };
    }

    case 'PLACE_LETTER': {
      if (!state.selected) return state;
      const { row, col } = state.selected;
      const withoutThisCell = state.pending.filter((p) => !(p.row === row && p.col === col));
      const placement: Placement = { row, col, letter: action.letter.toUpperCase(), isBlank: action.isBlank };
      const pending = [...withoutThisCell, placement];
      return { ...state, pending, selected: nextCell({ ...state, pending }, row, col) };
    }

    case 'PLACE_LETTER_AT': {
      if (!isSelectable(state, action.row, action.col)) return state;
      const withoutThisCell = state.pending.filter((p) => !(p.row === action.row && p.col === action.col));
      const placement: Placement = {
        row: action.row,
        col: action.col,
        letter: action.letter.toUpperCase(),
        isBlank: action.isBlank,
      };
      return { ...state, pending: [...withoutThisCell, placement] };
    }

    case 'REMOVE_AT':
      return { ...state, pending: state.pending.filter((p) => !(p.row === action.row && p.col === action.col)) };

    case 'BACKSPACE': {
      if (state.pending.length === 0) return state;
      const last = state.pending[state.pending.length - 1]!;
      return { ...state, pending: state.pending.slice(0, -1), selected: { row: last.row, col: last.col } };
    }

    case 'CLEAR':
      return { ...state, pending: [], selected: null };

    default:
      return state;
  }
}
