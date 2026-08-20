import type { MoveResult, PlayerPublicState } from '@scrabble/shared';

export interface MoveHistoryEntry {
  turnNumber: number;
  gamePlayerId: string;
  pseudo: string;
  type: MoveResult['type'];
  words: string[];
  score: number;
  triggeredBy: 'player' | 'timeout';
}

/** Traduit un `MoveResult` brut en résumé prêt à afficher dans "derniers mots joués". */
export function deriveMoveSummary(move: MoveResult, players: PlayerPublicState[]): MoveHistoryEntry {
  const player = players.find((p) => p.gamePlayerId === move.gamePlayerId);
  return {
    turnNumber: move.turnNumber,
    gamePlayerId: move.gamePlayerId,
    pseudo: player?.pseudo ?? 'Joueur',
    type: move.type,
    words: move.wordsFormed?.map((w) => w.word) ?? [],
    score: move.score,
    triggeredBy: move.triggeredBy,
  };
}
