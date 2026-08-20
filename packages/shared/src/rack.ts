import type { Letter } from './types.js';

/** Vérifie que le chevalet contient bien toutes les lettres données (multiset). */
export function hasLetters(rack: Letter[], letters: Letter[]): boolean {
  const remaining = [...rack];
  for (const letter of letters) {
    const idx = remaining.indexOf(letter);
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
}

/** Retire les lettres données du chevalet ; lève si une lettre est absente. */
export function removeFromRack(rack: Letter[], letters: Letter[]): Letter[] {
  const remaining = [...rack];
  for (const letter of letters) {
    const idx = remaining.indexOf(letter);
    if (idx === -1) throw new Error(`Lettre absente du chevalet: ${letter}`);
    remaining.splice(idx, 1);
  }
  return remaining;
}

export function addToRack(rack: Letter[], letters: Letter[]): Letter[] {
  return [...rack, ...letters];
}
