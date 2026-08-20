/** Une lettre de jeu : 'A'-'Z', ou '*' pour un joker non encore assigné dans un sac/chevalet. */
export type Letter = string;

export interface TileOnBoard {
  /** Lettre affichée/comptée pour le score (si joker, la lettre choisie par le joueur). */
  letter: Letter;
  isBlank: boolean;
  playedBy: string; // gamePlayerId
  turnNumber: number;
}

export type BoardCell = TileOnBoard | null;

export interface Board {
  /** [row][col], 15x15. */
  cells: BoardCell[][];
}

export interface PlayerState {
  gamePlayerId: string;
  seat: number;
  rack: Letter[];
  score: number;
  connected: boolean;
}

export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED';

export interface GameState {
  gameId: string;
  status: GameStatus;
  board: Board;
  bag: Letter[];
  players: PlayerState[];
  currentTurnIndex: number;
  consecutivePasses: number;
  turnNumber: number;
  turnTimeoutSeconds: number | null;
  /** Epoch ms ; recalculé à chaque changement de tour, `null` si pas de timeout configuré. */
  turnDeadline: number | null;
}

/** Une tuile posée sur le plateau par le coup en cours (avant validation). */
export interface Placement {
  row: number;
  col: number;
  /** Lettre choisie ; si `isBlank`, c'est la lettre que le joker représente. */
  letter: Letter;
  isBlank: boolean;
}

export interface WordFormed {
  word: string;
  score: number;
  cells: Array<{ row: number; col: number }>;
}

export type MoveType = 'PLACE' | 'EXCHANGE' | 'PASS';

export interface MoveResult {
  type: MoveType;
  gamePlayerId: string;
  turnNumber: number;
  tilesPlaced: Placement[] | null;
  wordsFormed: WordFormed[] | null;
  score: number;
  triggeredBy: 'player' | 'timeout';
}
