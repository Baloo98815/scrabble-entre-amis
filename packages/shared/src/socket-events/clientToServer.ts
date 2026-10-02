import { z } from 'zod';
import type { AckResponse, GameStatePayload, MoveAppliedPayload } from './payloads.js';

export const placementSchema = z.object({
  row: z.number().int().min(0).max(14),
  col: z.number().int().min(0).max(14),
  letter: z.string().length(1),
  isBlank: z.boolean(),
});

export const movePlaceSchema = z.object({ placements: z.array(placementSchema).min(1).max(7) });
export type MovePlaceInput = z.infer<typeof movePlaceSchema>;

export const moveExchangeSchema = z.object({ letters: z.array(z.string().length(1)).min(1).max(7) });
export type MoveExchangeInput = z.infer<typeof moveExchangeSchema>;

export const gameJoinSchema = z.object({ gameId: z.string().min(1) });
export type GameJoinInput = z.infer<typeof gameJoinSchema>;

export const wordProposeSchema = z.object({ word: z.string().trim().min(2).max(40) });
export type WordProposeInput = z.infer<typeof wordProposeSchema>;

export const wordVoteSchema = z.object({ proposalId: z.string().min(1), accept: z.boolean() });
export type WordVoteInput = z.infer<typeof wordVoteSchema>;

export interface ClientToServerEvents {
  'game:join': (input: GameJoinInput, ack: (res: AckResponse<GameStatePayload>) => void) => void;
  /**
   * Rejoint la partie en lecture seule (mode spectateur) : reçoit le plateau et les mises à
   * jour en direct, mais ne peut jamais jouer (move:place/exchange/pass restent bloqués,
   * faute de gamePlayerId associé à ce socket).
   */
  'game:spectate': (input: GameJoinInput, ack: (res: AckResponse<GameStatePayload>) => void) => void;
  /** Déclenché par le créateur (siège 0) quand la partie est en attente avec ≥2 joueurs. */
  'game:start': (ack: (res: AckResponse<GameStatePayload>) => void) => void;
  'move:place': (input: MovePlaceInput, ack: (res: AckResponse<MoveAppliedPayload>) => void) => void;
  'move:exchange': (input: MoveExchangeInput, ack: (res: AckResponse<MoveAppliedPayload>) => void) => void;
  'move:pass': (ack: (res: AckResponse<MoveAppliedPayload>) => void) => void;
  /** Scrabbullshit : « +1 » sur le mot du dernier coup (un clic par joueur et par mot, hors auteur). */
  'bonus:click': (ack: (res: AckResponse<null>) => void) => void;
  /** Scrabbullshit : le joueur au tour propose un mot absent du dictionnaire. */
  'word:propose': (input: WordProposeInput, ack: (res: AckResponse<null>) => void) => void;
  'word:vote': (input: WordVoteInput, ack: (res: AckResponse<null>) => void) => void;
  'word:cancelProposal': (ack: (res: AckResponse<null>) => void) => void;
  'game:leave': (ack: (res: AckResponse<null>) => void) => void;
}
