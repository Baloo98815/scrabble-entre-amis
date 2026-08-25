import { create } from 'zustand';
import type { Board, GameStatePayload, GameStatus, Letter, MoveAppliedPayload, PlayerPublicState } from '@scrabble/shared';
import { deriveMoveSummary, type MoveHistoryEntry } from './deriveMoveSummary.js';

const MAX_HISTORY = 20;

/**
 * Le serveur ne renvoie pas l'historique des coups dans GameStatePayload (seulement l'état
 * courant) — sans ça, "Derniers mots joués" repart à vide à chaque rechargement de page en
 * cours de partie. On comble ce manque côté client en gardant une copie en localStorage,
 * par partie. Best-effort : localStorage peut être indisponible (navigation privée) ou
 * contenir des données invalides — dans ce cas on dégrade silencieusement plutôt que de
 * planter l'affichage.
 */
function historyStorageKey(gameId: string): string {
  return `scrabble:history:${gameId}`;
}

function loadHistoryFromStorage(gameId: string): MoveHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(historyStorageKey(gameId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MoveHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(gameId: string, entries: MoveHistoryEntry[]): void {
  try {
    window.localStorage.setItem(historyStorageKey(gameId), JSON.stringify(entries));
  } catch {
    // Quota dépassé ou localStorage indisponible : tant pis, l'historique reste en mémoire
    // pour la session en cours.
  }
}

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
    set((state) => ({
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
      // Préremplit depuis localStorage seulement si on n'a pas déjà un historique en
      // mémoire pour cette partie (ex: reconnexion pendant la même session) — sans quoi une
      // resynchronisation en cours de partie effacerait des coups déjà affichés.
      moveHistory: state.moveHistory.length > 0 ? state.moveHistory : loadHistoryFromStorage(payload.gameId),
    })),

  applyMoveApplied: (payload) => {
    const entry = deriveMoveSummary(payload.move, get().players);
    set((state) => {
      const moveHistory = [entry, ...state.moveHistory].slice(0, MAX_HISTORY);
      if (state.gameId) saveHistoryToStorage(state.gameId, moveHistory);
      return {
        board: payload.board,
        players: payload.players,
        currentTurnIndex: payload.nextTurnIndex,
        bagCount: payload.bagCount,
        turnDeadline: payload.turnDeadline,
        status: payload.gameStatus,
        moveHistory,
      };
    });
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
