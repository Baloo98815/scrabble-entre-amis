import { BLANK, BLANK_COUNT, FRENCH_LETTER_DISTRIBUTION, type Board, type Letter } from '@scrabble/shared';

/**
 * Lettres « non vues » : distribution complète − tuiles posées sur le plateau − chevalet du
 * joueur. C'est ce que le client peut déduire sans que le serveur ne révèle le contenu du sac :
 * le résultat regroupe donc le sac ET les chevalets adverses. Un joker posé compte comme joker.
 */
export function computeUnseenLetters(board: Board | null, ownRack: Letter[]): Record<string, number> {
  const remaining: Record<string, number> = { [BLANK]: BLANK_COUNT };
  for (const [letter, { count }] of Object.entries(FRENCH_LETTER_DISTRIBUTION)) remaining[letter] = count;

  const consume = (letter: string): void => {
    if (letter in remaining) remaining[letter] = Math.max(0, (remaining[letter] ?? 0) - 1);
  };
  for (const row of board?.cells ?? []) {
    for (const cell of row) if (cell) consume(cell.isBlank ? BLANK : cell.letter);
  }
  for (const letter of ownRack) consume(letter);
  return remaining;
}
