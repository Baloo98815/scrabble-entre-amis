import { describe, expect, it } from 'vitest';
import type { Placement } from '@scrabble/shared';
import { computeVisibleRack } from './visibleRack.js';

function placement(row: number, col: number, letter: string, isBlank = false): Placement {
  return { row, col, letter, isBlank };
}

describe('computeVisibleRack', () => {
  it('returns every slot when nothing is pending', () => {
    expect(computeVisibleRack(['A', 'B', 'C'], [])).toEqual([
      { index: 0, letter: 'A' },
      { index: 1, letter: 'B' },
      { index: 2, letter: 'C' },
    ]);
  });

  it('hides exactly one slot per pending letter placed', () => {
    const rack = ['A', 'B', 'C'];
    const pending = [placement(7, 7, 'B')];
    expect(computeVisibleRack(rack, pending)).toEqual([
      { index: 0, letter: 'A' },
      { index: 2, letter: 'C' },
    ]);
  });

  it('hides only one instance of a duplicated letter, keeping the other visible', () => {
    const rack = ['O', 'O', 'X'];
    const pending = [placement(7, 7, 'O')];
    const visible = computeVisibleRack(rack, pending);
    expect(visible).toHaveLength(2);
    expect(visible.map((s) => s.letter).sort()).toEqual(['O', 'X']);
  });

  it('hides a blank slot when a placement uses a joker, regardless of the chosen letter', () => {
    const rack = ['*', 'B', 'C'];
    const pending = [placement(7, 7, 'Z', true)]; // joker joué comme "Z"
    expect(computeVisibleRack(rack, pending)).toEqual([
      { index: 1, letter: 'B' },
      { index: 2, letter: 'C' },
    ]);
  });

  it('does not hide anything twice if a matching letter cannot be found again', () => {
    const rack = ['A'];
    const pending = [placement(7, 7, 'A'), placement(7, 8, 'A')]; // 2e A introuvable
    expect(computeVisibleRack(rack, pending)).toEqual([]);
  });
});
