import { describe, expect, it } from 'vitest';
import { getBonus } from './board.js';
import { BINGO_BONUS, scoreMove, scoreWord } from './scoring.js';
import type { ExtractedWord, ExtractedWordCell } from './wordExtraction.js';

function cell(partial: Partial<ExtractedWordCell> & Pick<ExtractedWordCell, 'row' | 'col' | 'letter'>): ExtractedWordCell {
  return { isBlank: false, isNew: false, ...partial };
}

describe('scoreWord', () => {
  it('only applies cell multipliers to newly placed tiles', () => {
    // (0,0)=TW neuf, (0,1)/(0,2) existantes normales, (0,3)=DL neuf.
    expect(getBonus(0, 0).type).toBe('TW');
    expect(getBonus(0, 3).type).toBe('DL');

    const word: ExtractedWord = {
      word: 'ABCD',
      cells: [
        cell({ row: 0, col: 0, letter: 'A', isNew: true }), // 1 * 1 (lettre) => 1, mot x3
        cell({ row: 0, col: 1, letter: 'B', isNew: false }), // 3, pas de bonus (déjà joué)
        cell({ row: 0, col: 2, letter: 'C', isNew: false }), // 3
        cell({ row: 0, col: 3, letter: 'D', isNew: true }), // 2 * 2 (DL) => 4
      ],
    };
    // (1 + 3 + 3 + 4) * 3 = 33
    expect(scoreWord(word)).toBe(33);
  });

  it('does not apply a word/letter bonus to a tile placed on a previous turn', () => {
    expect(getBonus(0, 0).type).toBe('TW');
    const word: ExtractedWord = {
      word: 'A',
      cells: [cell({ row: 0, col: 0, letter: 'A', isNew: false })],
    };
    expect(scoreWord(word)).toBe(1);
  });

  it('cumulates multiple word multipliers on the same word', () => {
    expect(getBonus(1, 1).type).toBe('DW');
    expect(getBonus(1, 13).type).toBe('DW');
    const word: ExtractedWord = {
      word: 'AB',
      cells: [
        cell({ row: 1, col: 1, letter: 'A', isNew: true }), // valeur 1
        cell({ row: 1, col: 13, letter: 'B', isNew: true }), // valeur 3
      ],
    };
    // (1 + 3) * 2 * 2 = 16
    expect(scoreWord(word)).toBe(16);
  });

  it('a blank tile always scores 0, regardless of the letter it represents', () => {
    const word: ExtractedWord = {
      word: 'EX',
      cells: [
        cell({ row: 0, col: 1, letter: 'E', isBlank: true, isNew: true }),
        cell({ row: 0, col: 2, letter: 'X', isNew: false }),
      ],
    };
    expect(scoreWord(word)).toBe(10); // 0 (joker) + 10 (X)
  });
});

describe('scoreMove — bonus bingo', () => {
  const dummyWord: ExtractedWord = {
    word: 'AB',
    cells: [cell({ row: 0, col: 1, letter: 'A', isNew: true }), cell({ row: 0, col: 2, letter: 'B', isNew: true })],
  };

  it('awards the 50-point bonus when exactly 7 tiles are placed in one move', () => {
    const withoutBingo = scoreMove([dummyWord], 6);
    const withBingo = scoreMove([dummyWord], 7);
    expect(withBingo - withoutBingo).toBe(BINGO_BONUS);
  });

  it('does not award the bonus for 6 tiles', () => {
    const score = scoreMove([dummyWord], 6);
    expect(score).toBe(scoreWord(dummyWord));
  });
});
