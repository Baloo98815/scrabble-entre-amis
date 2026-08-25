import { useMemo } from 'react';
import { extractWordsFormed, scoreMove } from '@scrabble/shared';
import type { Board, Placement } from '@scrabble/shared';

/**
 * Aperçu du score que rapporterait le coup en cours de préparation, calculé avec les mêmes
 * fonctions pures que le serveur (extractWordsFormed/scoreMove) — pas de duplication de la
 * logique de score, juste anticipée côté client avant validation. Le placement en cours de
 * saisie peut être géométriquement incomplet (lettres pas encore alignées) : dans ce cas on
 * masque simplement l'aperçu plutôt que d'afficher un chiffre trompeur.
 */
export function useLivePreviewScore(board: Board | null, pending: Placement[]): number | null {
  return useMemo(() => {
    if (!board || pending.length === 0) return null;
    try {
      const words = extractWordsFormed(board, pending);
      if (words.length === 0) return null;
      return scoreMove(words, pending.length);
    } catch {
      return null;
    }
  }, [board, pending]);
}
