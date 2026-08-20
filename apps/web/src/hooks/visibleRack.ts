import type { Letter, Placement } from '@scrabble/shared';

export interface RackSlot {
  /** Index dans le chevalet complet (stable pour le drag & drop, y compris après un mélange). */
  index: number;
  letter: Letter;
}

/**
 * Emplacements du chevalet pas encore consommés par les placements en attente ce tour-ci.
 * Une lettre déjà posée sur le plateau (clavier ou glisser-déposer) ne doit plus apparaître
 * dans le chevalet — sans quoi elle pourrait être posée une seconde fois par erreur alors
 * qu'un seul exemplaire n'existe réellement dans la main du joueur.
 */
export function computeVisibleRack(rack: Letter[], pending: Placement[]): RackSlot[] {
  const consumedIndices = new Set<number>();
  for (const p of pending) {
    const target = p.isBlank ? '*' : p.letter;
    const idx = rack.findIndex((letter, i) => letter === target && !consumedIndices.has(i));
    if (idx !== -1) consumedIndices.add(idx);
  }
  return rack.map((letter, index) => ({ index, letter })).filter((slot) => !consumedIndices.has(slot.index));
}
