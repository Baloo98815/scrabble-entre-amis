import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { Board, Letter } from '@scrabble/shared';
import { createInitialPlacementState, placementReducer } from './placementReducer.js';
import { computeVisibleRack } from './visibleRack.js';

function boardOccupiedKeys(board: Board | null): Set<string> {
  const set = new Set<string>();
  if (!board) return set;
  board.cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell) set.add(`${r},${c}`);
    });
  });
  return set;
}

function isTypingInField(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/**
 * Gère la pose de lettres via le clavier : sélection d'une case, une flèche indique la
 * direction (horizontale/verticale, basculée en cliquant deux fois la même case), saisie
 * séquentielle avec avance automatique, Backspace/Échap pour corriger.
 */
export function useKeyboardPlacement(board: Board | null, rack: Letter[], enabled: boolean) {
  const [state, dispatch] = useReducer(placementReducer, undefined, createInitialPlacementState);

  useEffect(() => {
    dispatch({ type: 'SET_OCCUPIED', occupied: boardOccupiedKeys(board) });
  }, [board]);

  useEffect(() => {
    if (!enabled) dispatch({ type: 'CLEAR' });
  }, [enabled]);

  const selectCell = useCallback(
    (row: number, col: number) => {
      if (enabled) dispatch({ type: 'SELECT_CELL', row, col });
    },
    [enabled],
  );
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);
  const backspace = useCallback(() => dispatch({ type: 'BACKSPACE' }), []);
  const removeAt = useCallback(
    (row: number, col: number) => {
      if (enabled) dispatch({ type: 'REMOVE_AT', row, col });
    },
    [enabled],
  );

  /**
   * Emplacements du chevalet pas encore consommés par les placements en attente. C'est
   * cette liste — pas `rack` brut — qui doit être affichée : sans ça, une lettre déjà
   * glissée sur le plateau resterait visible et pourrait être reposée une 2e fois alors
   * qu'un seul exemplaire n'existe réellement dans la main du joueur.
   */
  const visibleRack = useMemo(() => computeVisibleRack(rack, state.pending), [rack, state.pending]);

  const remainingRack = useMemo(() => visibleRack.map((slot) => slot.letter), [visibleRack]);

  const placeLetter = useCallback(
    (letter: string) => {
      const upper = letter.toUpperCase();
      if (!/^[A-Z]$/.test(upper)) return;
      const hasExact = remainingRack.includes(upper);
      const isBlank = !hasExact && remainingRack.includes('*');
      if (!hasExact && !isBlank) return; // lettre indisponible dans le chevalet
      dispatch({ type: 'PLACE_LETTER', letter: upper, isBlank });
    },
    [remainingRack],
  );

  const placeLetterAt = useCallback(
    (row: number, col: number, letter: string, isBlank: boolean) => {
      if (!enabled) return;
      // Défense en profondeur : le chevalet affiché exclut déjà les lettres consommées,
      // donc un glisser-déposer ne devrait jamais viser une lettre indisponible — mais on
      // vérifie quand même pour ne jamais construire un coup que le serveur rejetterait.
      const stillAvailable = remainingRack.includes(isBlank ? '*' : letter.toUpperCase());
      if (!stillAvailable) return;
      dispatch({ type: 'PLACE_LETTER_AT', row, col, letter, isBlank });
    },
    [enabled, remainingRack],
  );

  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingInField()) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (e.key === 'Escape') {
        clear();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        placeLetter(e.key);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, backspace, clear, placeLetter]);

  return {
    selected: state.selected,
    direction: state.direction,
    pending: state.pending,
    remainingRack,
    visibleRack,
    selectCell,
    placeLetter,
    placeLetterAt,
    removeAt,
    clear,
    backspace,
  };
}
