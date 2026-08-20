import { describe, expect, it } from 'vitest';
import { applyEndOfGameAdjustments, isGameOver } from './endgame.js';
import type { GameState, PlayerState } from './types.js';
import { createEmptyBoard } from './board.js';

function player(overrides: Partial<PlayerState> & Pick<PlayerState, 'gamePlayerId'>): PlayerState {
  return { seat: 0, rack: [], score: 0, connected: true, ...overrides };
}

function baseState(overrides: Partial<GameState>): GameState {
  return {
    gameId: 'g1',
    status: 'IN_PROGRESS',
    board: createEmptyBoard(),
    bag: [],
    players: [],
    currentTurnIndex: 0,
    consecutivePasses: 0,
    turnNumber: 0,
    turnTimeoutSeconds: null,
    turnDeadline: null,
    ...overrides,
  };
}

describe('isGameOver', () => {
  it('is false while the bag has tiles and no stalemate', () => {
    const state = baseState({
      bag: ['A'],
      players: [player({ gamePlayerId: 'p1', rack: ['B'] })],
    });
    expect(isGameOver(state)).toBe(false);
  });

  it('is true when the bag is empty and a player has an empty rack', () => {
    const state = baseState({
      bag: [],
      players: [player({ gamePlayerId: 'p1', rack: [] }), player({ gamePlayerId: 'p2', rack: ['Z'] })],
    });
    expect(isGameOver(state)).toBe(true);
  });

  it('is false when the bag is empty but no rack is empty', () => {
    const state = baseState({
      bag: [],
      players: [player({ gamePlayerId: 'p1', rack: ['A'] }), player({ gamePlayerId: 'p2', rack: ['Z'] })],
    });
    expect(isGameOver(state)).toBe(false);
  });

  it('is true after 2x the number of players of consecutive passes', () => {
    const state = baseState({
      bag: ['A'],
      consecutivePasses: 4,
      players: [player({ gamePlayerId: 'p1' }), player({ gamePlayerId: 'p2' })],
    });
    expect(isGameOver(state)).toBe(true);
  });
});

describe('applyEndOfGameAdjustments', () => {
  it('gives the finisher the value of opponents remaining tiles, and deducts it from them', () => {
    const state = baseState({
      bag: [],
      players: [
        player({ gamePlayerId: 'finisher', rack: [], score: 100 }),
        player({ gamePlayerId: 'other', rack: ['Z', 'A'], score: 50 }), // 10 + 1 = 11
      ],
    });
    const result = applyEndOfGameAdjustments(state);
    expect(result.status).toBe('FINISHED');
    const finisher = result.players.find((p) => p.gamePlayerId === 'finisher')!;
    const other = result.players.find((p) => p.gamePlayerId === 'other')!;
    expect(finisher.score).toBe(100 + 11);
    expect(other.score).toBe(50 - 11); // perd aussi la valeur de ses propres lettres restantes
  });

  it('deducts each remaining rack value when the game ends by stalemate (no finisher)', () => {
    const state = baseState({
      bag: ['A'], // sac non vide => pas de "finisher", fin par blocage
      consecutivePasses: 4,
      players: [
        player({ gamePlayerId: 'p1', rack: ['Z'], score: 100 }), // -10
        player({ gamePlayerId: 'p2', rack: ['A', 'A'], score: 50 }), // -2
      ],
    });
    const result = applyEndOfGameAdjustments(state);
    expect(result.players.find((p) => p.gamePlayerId === 'p1')!.score).toBe(90);
    expect(result.players.find((p) => p.gamePlayerId === 'p2')!.score).toBe(48);
  });
});
