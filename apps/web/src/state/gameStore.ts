import { create } from 'zustand';
import type { Board, GameStatePayload, GameStatus, Letter, MoveAppliedPayload, PlayerPublicState } from '@scrabble/shared';
import { deriveMoveSummary, type MoveHistoryEntry } from './deriveMoveSummary.js';

const MAX_HISTORY = 20;

interface GameStoreState {
  gameId: string | null;
  inviteCode: string | null;
  status: GameStatus | 'IDLE';
  board: Board | null;
  bagCount: number;
  players: PlayerPublicState[];
  currentTurnIndex: number;
  turnNumber: number;
  turnDeadline: number | null;
  yourRack: Letter[];
  moveHistory: MoveHistoryEntry[];

  applyGameState: (payload: GameStatePayload) => void;
  applyMoveApplied: (payload: MoveAppliedPayload) => void;
  applyRackUpdate: (rack: Letter[]) => void;
  setPlayerConnection: (gamePlayerId: string, connected: boolean) => void;
  removePlayer: (gamePlayerId: string) => void;
  reset: () => void;
}

const initialState = {
  gameId: null,
  inviteCode: null,
  status: 'IDLE' as GameStatus | 'IDLE',
  board: null,
  bagCount: 0,
  players: [] as PlayerPublicState[],
  currentTurnIndex: 0,
  turnNumber: 0,
  turnDeadline: null,
  yourRack: [] as Letter[],
  moveHistory: [] as MoveHistoryEntry[],
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...initialState,

  applyGameState: (payload) =>
    set({
      gameId: payload.gameId,
      inviteCode: payload.inviteCode,
      status: payload.status,
      board: payload.board,
      bagCount: payload.bagCount,
      players: payload.players,
      currentTurnIndex: payload.currentTurnIndex,
      turnNumber: payload.turnNumber,
      turnDeadline: payload.turnDeadline,
      yourRack: payload.yourRack,
    }),

  applyMoveApplied: (payload) => {
    const entry = deriveMoveSummary(payload.move, get().players);
    set((state) => ({
      board: payload.board,
      players: payload.players,
      currentTurnIndex: payload.nextTurnIndex,
      bagCount: payload.bagCount,
      turnDeadline: payload.turnDeadline,
      status: payload.gameStatus,
      moveHistory: [entry, ...state.moveHistory].slice(0, MAX_HISTORY),
    }));
  },

  applyRackUpdate: (rack) => set({ yourRack: rack }),

  setPlayerConnection: (gamePlayerId, connected) =>
    set((state) => ({
      players: state.players.map((p) => (p.gamePlayerId === gamePlayerId ? { ...p, connected } : p)),
    })),

  removePlayer: (gamePlayerId) =>
    set((state) => ({ players: state.players.filter((p) => p.gamePlayerId !== gamePlayerId) })),

  reset: () => set(initialState),
}));
