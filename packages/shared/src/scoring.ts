import { getBonus } from './board.js';
import { letterValue } from './letterBag.js';
import type { ExtractedWord } from './wordExtraction.js';

export const BINGO_BONUS = 50;
export const BINGO_TILE_COUNT = 7;

/**
 * Score d'un mot formé : les multiplicateurs de case (lettre et mot) ne s'appliquent
 * qu'aux tuiles posées CE tour-ci — une case bonus déjà "consommée" à un tour précédent
 * ne compte plus.
 */
export function scoreWord(word: ExtractedWord): number {
  let letterSum = 0;
  let wordMultiplier = 1;

  for (const cell of word.cells) {
    const baseValue = cell.isBlank ? 0 : letterValue(cell.letter);

    if (!cell.isNew) {
      letterSum += baseValue;
      continue;
    }

    const bonus = getBonus(cell.row, cell.col);
    let letterMultiplier = 1;
    if (bonus.type === 'DL') letterMultiplier = 2;
    else if (bonus.type === 'TL') letterMultiplier = 3;
    letterSum += baseValue * letterMultiplier;

    if (bonus.type === 'DW') wordMultiplier *= 2;
    else if (bonus.type === 'TW') wordMultiplier *= 3;
  }

  return letterSum * wordMultiplier;
}

/** Score total d'un coup : somme des mots formés + bonus "scrabble" (bingo). */
export function scoreMove(words: ExtractedWord[], newTileCount: number): number {
  const wordsScore = words.reduce((sum, word) => sum + scoreWord(word), 0);
  const bingo = newTileCount >= BINGO_TILE_COUNT ? BINGO_BONUS : 0;
  return wordsScore + bingo;
}
