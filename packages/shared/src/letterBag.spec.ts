import { describe, expect, it } from 'vitest';
import {
  BLANK,
  BLANK_COUNT,
  FRENCH_LETTER_DISTRIBUTION,
  RACK_SIZE,
  TOTAL_TILE_COUNT,
  createInitialBag,
  drawLetters,
  letterValue,
  refillRack,
} from './letterBag.js';

describe('letterBag', () => {
  it('contains exactly 102 tiles (100 lettres + 2 jokers)', () => {
    const bag = createInitialBag(() => 0.5);
    expect(bag.length).toBe(TOTAL_TILE_COUNT);
  });

  it('respects the official French distribution counts and values', () => {
    const bag = createInitialBag(() => 0.5);
    for (const [letter, { count, value }] of Object.entries(FRENCH_LETTER_DISTRIBUTION)) {
      expect(bag.filter((l) => l === letter).length).toBe(count);
      expect(letterValue(letter)).toBe(value);
    }
    expect(bag.filter((l) => l === BLANK).length).toBe(BLANK_COUNT);
  });

  it('blanks are worth 0 points', () => {
    expect(letterValue(BLANK)).toBe(0);
  });

  it('throws for an unknown letter', () => {
    expect(() => letterValue('#')).toThrow();
  });

  it('draws letters and shrinks the bag accordingly', () => {
    const bag = createInitialBag(() => 0.5);
    const { drawn, remaining } = drawLetters(bag, 7);
    expect(drawn.length).toBe(7);
    expect(remaining.length).toBe(bag.length - 7);
  });

  it('does not draw more letters than available', () => {
    const { drawn, remaining } = drawLetters(['A', 'B'], 7);
    expect(drawn.length).toBe(2);
    expect(remaining.length).toBe(0);
  });

  it('refills a rack up to the target size without exceeding it', () => {
    const bag = createInitialBag(() => 0.5);
    const { rack, bag: remaining } = refillRack(bag, ['A', 'B'], RACK_SIZE);
    expect(rack.length).toBe(RACK_SIZE);
    expect(remaining.length).toBe(bag.length - 5);
  });

  it('does not draw anything if the rack is already full', () => {
    const bag = createInitialBag(() => 0.5);
    const fullRack = new Array(RACK_SIZE).fill('A');
    const { rack, bag: remaining } = refillRack(bag, fullRack, RACK_SIZE);
    expect(rack.length).toBe(RACK_SIZE);
    expect(remaining.length).toBe(bag.length);
  });
});
