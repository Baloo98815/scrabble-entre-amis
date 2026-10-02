import type { GameMode } from '../dto/game.js';
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

/** Points totaux accordés à l'auteur d'un mot selon le nombre de « +1 » reçus (0, 1, 2, 3 clics). */
export const BONUS_TOTALS = [0, 1, 5, 10] as const;

export function bonusTotal(clicks: number): number {
  return BONUS_TOTALS[Math.min(Math.max(clicks, 0), BONUS_TOTALS.length - 1)] ?? 0;
}

/** Mode Scrabbullshit : « +1 » ouvert sur le mot principal du dernier coup posé. */
export interface BonusState {
  turnNumber: number;
  word: string;
  /** gamePlayerId de l'auteur du mot (bénéficiaire des points). */
  authorId: string;
  /** gamePlayerId de ceux qui ont déjà cliqué. */
  voterIds: string[];
}

/** Mode Scrabbullshit : mot proposé par le joueur dont c'est le tour, soumis au vote de tous les autres. */
export interface ProposalState {
  id: string;
  word: string;
  proposerId: string;
  accepted: string[];
  rejected: string[];
}

export interface ProposalResolvedPayload {
  id: string;
  word: string;
  outcome: 'accepted' | 'rejected' | 'cancelled';
}

/** Diffusé à la room quand le bonus, la proposition ou les mots ajoutés changent. */
export interface BullshitUpdatePayload {
  bonus: BonusState | null;
  proposal: ProposalState | null;
  extraWords: string[];
  players: PlayerPublicState[];
}

/** Snapshot complet envoyé à UN joueur au join/reconnect (contient son propre rack). */
export interface GameStatePayload {
  gameId: string;
  mode: GameMode;
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
  /** Mode Scrabbullshit uniquement (toujours null / vide en Classic). */
  bonus: BonusState | null;
  proposal: ProposalState | null;
  /** Mots acceptés à l'unanimité pour cette partie uniquement. */
  extraWords: string[];
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
  /** Bonus « +1 » ouvert par ce coup (null si aucun : Classic, échange, passe). */
  bonus: BonusState | null;
}

export interface GameEndedPayload {
  finalScores: Array<{ gamePlayerId: string; pseudo: string; score: number }>;
  reason: 'emptied_rack' | 'stalemate';
}
