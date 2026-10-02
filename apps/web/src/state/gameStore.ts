import { create } from 'zustand';
import type {
  Board,
  BonusState,
  BullshitUpdatePayload,
  GameMode,
  GameStatePayload,
  GameStatus,
  Letter,
  MoveAppliedPayload,
  PlayerPublicState,
  ProposalResolvedPayload,
  ProposalState,
} from '@scrabble/shared';
import { deriveMoveSummary, type MoveHistoryEntry } from './deriveMoveSummary.js';

const MAX_HISTORY = 20;

/** Applique les scores/connexions d'un payload diffusé (isYou y vaut toujours false) en gardant notre isYou. */
function mergePlayers(previous: PlayerPublicState[], next: PlayerPublicState[]): PlayerPublicState[] {
  return next.map((p) => ({ ...p, isYou: previous.find((q) => q.gamePlayerId === p.gamePlayerId)?.isYou ?? p.isYou }));
}

interface GameStoreState {
  gameId: string | null;
  mode: GameMode;
  bonus: BonusState | null;
  proposal: ProposalState | null;
  extraWords: string[];
  proposalOutcome: ProposalResolvedPayload | null;
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
  applyBullshitUpdate: (payload: BullshitUpdatePayload) => void;
  applyProposalResolved: (payload: ProposalResolvedPayload) => void;
  dismissProposalOutcome: () => void;
  setPlayerConnection: (gamePlayerId: string, connected: boolean) => void;
  removePlayer: (gamePlayerId: string) => void;
  reset: () => void;
}

const initialState = {
  gameId: null,
  mode: 'CLASSIC' as GameMode,
  bonus: null as BonusState | null,
  proposal: null as ProposalState | null,
  extraWords: [] as string[],
  proposalOutcome: null as ProposalResolvedPayload | null,
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
    set(() => ({
      gameId: payload.gameId,
      mode: payload.mode,
      bonus: payload.bonus,
      proposal: payload.proposal,
      extraWords: payload.extraWords,
      inviteCode: payload.inviteCode,
      status: payload.status,
      board: payload.board,
      bagCount: payload.bagCount,
      players: payload.players,
      currentTurnIndex: payload.currentTurnIndex,
      turnNumber: payload.turnNumber,
      turnDeadline: payload.turnDeadline,
      yourRack: payload.yourRack,
      // L'historique vient de la base (via le serveur) : même résultat quel que soit le navigateur.
      moveHistory: payload.moveHistory
        .map((m) => deriveMoveSummary(m, payload.players))
        .reverse()
        .slice(0, MAX_HISTORY),
    })),

  applyMoveApplied: (payload) => {
    const entry = deriveMoveSummary(payload.move, get().players);
    set((state) => {
      const moveHistory = [entry, ...state.moveHistory].slice(0, MAX_HISTORY);
      return {
        board: payload.board,
        players: mergePlayers(state.players, payload.players),
        bonus: payload.bonus,
        proposal: null,
        currentTurnIndex: payload.nextTurnIndex,
        bagCount: payload.bagCount,
        turnDeadline: payload.turnDeadline,
        status: payload.gameStatus,
        moveHistory,
      };
    });
  },

  applyRackUpdate: (rack) => set({ yourRack: rack }),

  applyBullshitUpdate: (payload) =>
    set((state) => ({
      bonus: payload.bonus,
      proposal: payload.proposal,
      extraWords: payload.extraWords,
      players: mergePlayers(state.players, payload.players),
    })),

  applyProposalResolved: (payload) => set({ proposalOutcome: payload }),

  dismissProposalOutcome: () => set({ proposalOutcome: null }),

  setPlayerConnection: (gamePlayerId, connected) =>
    set((state) => ({
      players: state.players.map((p) => (p.gamePlayerId === gamePlayerId ? { ...p, connected } : p)),
    })),

  removePlayer: (gamePlayerId) =>
    set((state) => ({ players: state.players.filter((p) => p.gamePlayerId !== gamePlayerId) })),

  reset: () => set(initialState),
}));
