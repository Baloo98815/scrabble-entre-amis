import type { CreateGameInput, GameSummary, JoinGameInput } from '@scrabble/shared';
import { api } from './http.js';

export function createGame(input: CreateGameInput): Promise<{ game: GameSummary }> {
  return api.post<{ game: GameSummary }>('/games', input);
}

export function previewGame(inviteCode: string): Promise<{ game: GameSummary }> {
  return api.get<{ game: GameSummary }>(`/games/${inviteCode}`);
}

export function joinGame(inviteCode: string, input: JoinGameInput): Promise<{ game: GameSummary }> {
  return api.post<{ game: GameSummary }>(`/games/${inviteCode}/join`, input);
}

export function myGames(): Promise<{ games: GameSummary[] }> {
  return api.get<{ games: GameSummary[] }>('/games/mine');
}

export interface MoveHistoryRow {
  id: string;
  gamePlayerId: string;
  turnNumber: number;
  type: 'PLACE' | 'EXCHANGE' | 'PASS';
  score: number;
  wordsFormed: Array<{ word: string; score: number }> | null;
  createdAt: string;
}

export function gameDetail(gameId: string): Promise<{ game: GameSummary & { moves: MoveHistoryRow[] } }> {
  return api.get<{ game: GameSummary & { moves: MoveHistoryRow[] } }>(`/games/${gameId}/detail`);
}

export function checkWord(word: string): Promise<{ word: string; valid: boolean }> {
  return api.get<{ word: string; valid: boolean }>(`/dictionary/check/${encodeURIComponent(word)}`);
}
