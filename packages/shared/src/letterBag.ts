import type { Letter } from './types.js';

/** Répartition officielle française des 100 jetons lettrés (hors jokers). */
export const FRENCH_LETTER_DISTRIBUTION: Record<string, { count: number; value: number }> = {
  A: { count: 9, value: 1 },
  B: { count: 2, value: 3 },
  C: { count: 2, value: 3 },
  D: { count: 3, value: 2 },
  E: { count: 15, value: 1 },
  F: { count: 2, value: 4 },
  G: { count: 2, value: 2 },
  H: { count: 2, value: 4 },
  I: { count: 8, value: 1 },
  J: { count: 1, value: 8 },
  K: { count: 1, value: 10 },
  L: { count: 5, value: 1 },
  M: { count: 3, value: 2 },
  N: { count: 6, value: 1 },
  O: { count: 6, value: 1 },
  P: { count: 2, value: 3 },
  Q: { count: 1, value: 8 },
  R: { count: 6, value: 1 },
  S: { count: 6, value: 1 },
  T: { count: 6, value: 1 },
  U: { count: 6, value: 1 },
  V: { count: 2, value: 4 },
  W: { count: 1, value: 10 },
  X: { count: 1, value: 10 },
  Y: { count: 1, value: 10 },
  Z: { count: 1, value: 10 },
};

export const BLANK: Letter = '*';
export const BLANK_COUNT = 2;
export const BLANK_VALUE = 0;

/** 100 lettres + 2 jokers. */
export const TOTAL_TILE_COUNT = 102;

export const RACK_SIZE = 7;
export const MIN_EXCHANGE_BAG_SIZE = 7;

export function letterValue(letter: Letter): number {
  if (letter === BLANK) return BLANK_VALUE;
  const entry = FRENCH_LETTER_DISTRIBUTION[letter];
  if (!entry) throw new Error(`Lettre inconnue: ${letter}`);
  return entry.value;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function createInitialBag(rng: () => number = Math.random): Letter[] {
  const bag: Letter[] = [];
  for (const [letter, { count }] of Object.entries(FRENCH_LETTER_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) bag.push(letter);
  }
  for (let i = 0; i < BLANK_COUNT; i++) bag.push(BLANK);
  return shuffle(bag, rng);
}

export function drawLetters(
  bag: Letter[],
  count: number,
): { drawn: Letter[]; remaining: Letter[] } {
  const n = Math.min(count, bag.length);
  return { drawn: bag.slice(0, n), remaining: bag.slice(n) };
}

export function refillRack(
  bag: Letter[],
  rack: Letter[],
  targetSize: number = RACK_SIZE,
): { rack: Letter[]; bag: Letter[] } {
  const need = Math.max(0, targetSize - rack.length);
  const { drawn, remaining } = drawLetters(bag, need);
  return { rack: [...rack, ...drawn], bag: remaining };
}
