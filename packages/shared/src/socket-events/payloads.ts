import type { Board, GameStatus, Letter, MoveResult } from '../types.js';

export interface AckSuccess<T> {
  ok: true;
  data: T;
}
export interface AckFailure {
  ok: false;
  error: { code: string; message: string };
}
export type AckResponse<T> = AckSuccess<T> | AckFailure;

export interface PlayerPublicState {
  gamePlayerId: string;
  pseudo: string;
  seat: number;
  score: number;
  /** Nombre de lettres dans le chevalet - jamais les lettres elles-mêmes pour les autres joueurs. */
  rackCount: number;
  connected: boolean;
  isYou: boolean;
}

/** Résumé d'un coup passé, tel que persisté en base (sans lettres des chevalets). */
export interface MoveHistoryItem {
  turnNumber: number;
  gamePlayerId: string;
  type: MoveResult['type'];
  words: string[];
  score: number;
  triggeredBy: 'player' | 'timeout';
}

/** Snapshot complet envoyé à UN joueur au join/reconnect (contient son propre rack). */
export interface GameStatePayload {
  gameId: string;
  /** Code utilisé dans le lien d'invitation partageable (/g/:inviteCode). */
  inviteCode: string;
  status: GameStatus;
  board: Board;
  bagCount: number;
  players: PlayerPublicState[];
  currentTurnIndex: number;
  turnNumber: number;
  /** Epoch ms, `null` si pas de timeout configuré pour cette partie. */
  turnDeadline: number | null;
  yourRack: Letter[];
  /** Historique des coups (ordre chronologique), issu de la base : identique quel que soit le navigateur. */
  moveHistory: MoveHistoryItem[];
}

/** Diffusé à toute la room après un coup - ne contient jamais les lettres des autres joueurs. */
export interface MoveAppliedPayload {
  move: MoveResult;
  /** Plateau à jour (les cases sont publiques par nature, contrairement aux chevalets). */
  board: Board;
  players: PlayerPublicState[];
  nextTurnIndex: number;
  bagCount: number;
  turnDeadline: number | null;
  gameStatus: GameStatus;
}

export interface GameEndedPayload {
  finalScores: Array<{ gamePlayerId: string; pseudo: string; score: number }>;
  reason: 'emptied_rack' | 'stalemate';
}
