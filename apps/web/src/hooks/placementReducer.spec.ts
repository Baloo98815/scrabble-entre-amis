import { describe, expect, it } from 'vitest';
import { createInitialPlacementState, placementReducer, type PlacementState } from './placementReducer.js';

function typeWord(state: PlacementState, word: string): PlacementState {
  return [...word].reduce(
    (s, letter) => placementReducer(s, { type: 'PLACE_LETTER', letter, isBlank: false }),
    state,
  );
}

describe('placementReducer', () => {
  it('selects a cell and types a word horizontally, advancing the cursor each time', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    state = typeWord(state, 'CAT');

    expect(state.pending).toEqual([
      { row: 7, col: 7, letter: 'C', isBlank: false },
      { row: 7, col: 8, letter: 'A', isBlank: false },
      { row: 7, col: 9, letter: 'T', isBlank: false },
    ]);
    expect(state.selected).toEqual({ row: 7, col: 10 });
  });

  it('toggles direction when the same cell is selected twice', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    expect(state.direction).toBe('horizontal');
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    expect(state.direction).toBe('vertical');
    expect(state.selected).toEqual({ row: 7, col: 7 });
  });

  it('types vertically after toggling direction', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 }); // -> vertical
    state = typeWord(state, 'GO');

    expect(state.pending).toEqual([
      { row: 7, col: 7, letter: 'G', isBlank: false },
      { row: 8, col: 7, letter: 'O', isBlank: false },
    ]);
    expect(state.selected).toEqual({ row: 9, col: 7 });
  });

  it('skips over cells already occupied by confirmed tiles on the board', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SET_OCCUPIED', occupied: new Set(['7,8']) });
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    state = placementReducer(state, { type: 'PLACE_LETTER', letter: 'C', isBlank: false });

    expect(state.pending).toEqual([{ row: 7, col: 7, letter: 'C', isBlank: false }]);
    expect(state.selected).toEqual({ row: 7, col: 9 }); // (7,8) sautée
  });

  it('refuses to select a cell already occupied by a confirmed tile', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SET_OCCUPIED', occupied: new Set(['7,7']) });
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    expect(state.selected).toBeNull();
  });

  it('backspace removes the last placed letter and reselects its cell', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    state = typeWord(state, 'CAT');
    state = placementReducer(state, { type: 'BACKSPACE' });

    expect(state.pending).toEqual([
      { row: 7, col: 7, letter: 'C', isBlank: false },
      { row: 7, col: 8, letter: 'A', isBlank: false },
    ]);
    expect(state.selected).toEqual({ row: 7, col: 9 });
  });

  it('does nothing on backspace when there is nothing pending', () => {
    const state = createInitialPlacementState();
    expect(placementReducer(state, { type: 'BACKSPACE' })).toBe(state);
  });

  it('clears all pending placements and the selection', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    state = typeWord(state, 'CAT');
    state = placementReducer(state, { type: 'CLEAR' });

    expect(state.pending).toEqual([]);
    expect(state.selected).toBeNull();
  });

  it('places a letter at an arbitrary cell via drag & drop without needing a selection', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'PLACE_LETTER_AT', row: 3, col: 4, letter: 'z', isBlank: false });
    expect(state.pending).toEqual([{ row: 3, col: 4, letter: 'Z', isBlank: false }]);
    expect(state.selected).toBeNull(); // le drop ne modifie pas la sélection clavier
  });

  it('refuses to drop on a cell already occupied by a confirmed tile', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SET_OCCUPIED', occupied: new Set(['3,4']) });
    state = placementReducer(state, { type: 'PLACE_LETTER_AT', row: 3, col: 4, letter: 'Z', isBlank: false });
    expect(state.pending).toEqual([]);
  });

  it('removes a specific pending placement (e.g. dragged back off the board)', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    state = typeWord(state, 'CAT');
    state = placementReducer(state, { type: 'REMOVE_AT', row: 7, col: 8 });
    expect(state.pending).toEqual([
      { row: 7, col: 7, letter: 'C', isBlank: false },
      { row: 7, col: 9, letter: 'T', isBlank: false },
    ]);
  });

  it('deselects when typing runs off the edge of the board', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 14 });
    state = placementReducer(state, { type: 'PLACE_LETTER', letter: 'Z', isBlank: false });
    expect(state.selected).toBeNull();
    expect(state.pending).toEqual([{ row: 7, col: 14, letter: 'Z', isBlank: false }]);
  });

  it('re-typing over a pending cell replaces it instead of duplicating', () => {
    let state = createInitialPlacementState();
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    state = placementReducer(state, { type: 'PLACE_LETTER', letter: 'C', isBlank: false });
    // La sélection a avancé à (7,8) ; on revient sur (7,7) pour la remplacer par un joker.
    state = placementReducer(state, { type: 'SELECT_CELL', row: 7, col: 7 });
    state = placementReducer(state, { type: 'PLACE_LETTER', letter: 'K', isBlank: true });
    expect(state.pending).toEqual([{ row: 7, col: 7, letter: 'K', isBlank: true }]);
  });
});
