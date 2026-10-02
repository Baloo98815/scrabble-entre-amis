import { z } from 'zod';

export const gameModeSchema = z.enum(['CLASSIC', 'SCRABBULLSHIT']);
export type GameMode = z.infer<typeof gameModeSchema>;

export const createGameSchema = z.object({
  mode: gameModeSchema.default('CLASSIC'),
  maxPlayers: z.number().int().min(2).max(4).default(4),
  /** null/absent = pas de timeout ; sinon durée en secondes avant auto-pass. */
  turnTimeoutSeconds: z.number().int().min(15).max(600).nullable().optional(),
  /** Requis si le créateur n'est pas authentifié. */
  pseudo: z.string().trim().min(2).max(24).optional(),
});
export type CreateGameInput = z.infer<typeof createGameSchema>;

export const joinGameSchema = z.object({
  /** Requis si le joueur n'est pas authentifié. */
  pseudo: z.string().trim().min(2).max(24).optional(),
});
export type JoinGameInput = z.infer<typeof joinGameSchema>;

export interface GamePlayerSummary {
  gamePlayerId: string;
  pseudo: string;
  seat: number;
  score: number;
  isConnected: boolean;
  isYou: boolean;
}

export interface GameSummary {
  id: string;
  inviteCode: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';
  mode: GameMode;
  maxPlayers: number;
  turnTimeoutSeconds: number | null;
  createdAt: string;
  players: GamePlayerSummary[];
}
