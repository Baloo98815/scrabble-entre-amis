import { describe, expect, it } from 'vitest';
import { bonusTotal } from './payloads.js';

describe('bonusTotal', () => {
  it('donne 0, 1, 5 puis 10 points selon le nombre de clics', () => {
    expect([0, 1, 2, 3].map(bonusTotal)).toEqual([0, 1, 5, 10]);
  });
  it('plafonne à 10 et ignore les valeurs négatives', () => {
    expect(bonusTotal(7)).toBe(10);
    expect(bonusTotal(-1)).toBe(0);
  });
});
