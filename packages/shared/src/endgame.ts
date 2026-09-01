import type { GameState } from './types.js';
import { letterValue } from './letterBag.js';

/**
 * Fin de partie : le sac est vide et un joueur a posé sa dernière lettre, OU un nombre de
 * tours consécutifs sans pose de mot (passes/échanges) a été atteint (2x le nombre de
 * joueurs, pour éviter un blocage indéfini).
 */
export function isGameOver(state: GameState): boolean {
  const bagEmpty = state.bag.length === 0;
  const someoneEmptiedRack = bagEmpty && state.players.some((p) => p.rack.length === 0);
  const stalemate = state.consecutivePasses >= state.players.length * 2;
  return someoneEmptiedRack || stalemate;
}

/**
 * Ajustements de score de fin de partie (règle officielle) : chaque joueur perd la valeur
 * des lettres restant dans son propre chevalet ; si un joueur a vidé le sien (fin par sac
 * vide), il reçoit en plus la somme des valeurs restant dans les chevalets de tous les
 * adversaires.
 */
export function applyEndOfGameAdjustments(state: GameState): GameState {
  const bagEmpty = state.bag.length === 0;
  const finisher = bagEmpty ? state.players.find((p) => p.rack.length === 0) : undefined;

  const remainingValueByPlayer = new Map<string, number>(
    state.players.map((p) => [p.gamePlayerId, p.rack.reduce((sum, letter) => sum + letterValue(letter), 0)]),
  );

  const players = state.players.map((p) => {
    const remaining = remainingValueByPlayer.get(p.gamePlayerId) ?? 0;
    if (finisher && p.gamePlayerId === finisher.gamePlayerId) {
      const othersRemaining = state.players
        .filter((other) => other.gamePlayerId !== p.gamePlayerId)
        .reduce((sum, other) => sum + (remainingValueByPlayer.get(other.gamePlayerId) ?? 0), 0);
      return { ...p, score: p.score + othersRemaining };
    }
    return { ...p, score: p.score - remaining };
  });

  return { ...state, players, status: 'FINISHED' };
}
