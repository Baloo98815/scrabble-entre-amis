import { describe, expect, it } from 'vitest';
import { CENTER } from './board.js';
import { acceptAllDictionary, createSetDictionary } from './dictionaryValidator.js';
import { RACK_SIZE, TOTAL_TILE_COUNT } from './letterBag.js';
import {
  InvalidMoveError,
  applyExchange,
  applyPass,
  applyPlaceMove,
  createInitialGameState,
} from './turnEngine.js';
import type { GameState, Placement } from './types.js';

describe('createInitialGameState', () => {
  it('deals a full rack to each player and shrinks the bag accordingly', () => {
    const state = createInitialGameState({ gameId: 'g1', playerIds: ['p1', 'p2', 'p3'], rng: () => 0.42 });
    expect(state.players).toHaveLength(3);
    for (const player of state.players) {
      expect(player.rack).toHaveLength(RACK_SIZE);
      expect(player.score).toBe(0);
    }
    expect(state.bag.length).toBe(TOTAL_TILE_COUNT - 3 * RACK_SIZE);
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.currentTurnIndex).toBe(0);
  });
});

/** Construit un état de jeu déterministe pour les tests, avec des chevalets imposés. */
function makeState(params: { racks: string[][] } & Partial<Omit<GameState, 'players'>>): GameState {
  const { racks, ...overrides } = params;
  const players = racks.map((rack, seat) => ({
    gamePlayerId: `p${seat + 1}`,
    seat,
    rack,
    score: 0,
    connected: true,
  }));
  const base = createInitialGameState({
    gameId: 'g1',
    playerIds: players.map((p) => p.gamePlayerId),
    rng: () => 0.1,
  });
  return { ...base, ...overrides, players };
}

describe('applyPlaceMove', () => {
  it('places the first word, scores it, refills the rack and advances the turn', () => {
    const dictionary = createSetDictionary(['CHAT']);
    const state = makeState({ racks: [['C', 'H', 'A', 'T', 'X', 'Y', 'Z'], ['A', 'B', 'C', 'D', 'E', 'F', 'G']] });
    const placements: Placement[] = [
      { row: CENTER, col: CENTER - 1, letter: 'C', isBlank: false },
      { row: CENTER, col: CENTER, letter: 'H', isBlank: false },
      { row: CENTER, col: CENTER + 1, letter: 'A', isBlank: false },
      { row: CENTER, col: CENTER + 2, letter: 'T', isBlank: false },
    ];

    const { state: next, result } = applyPlaceMove(state, placements, dictionary);

    expect(result.type).toBe('PLACE');
    expect(result.wordsFormed).toHaveLength(1);
    expect(result.wordsFormed![0]!.word).toBe('CHAT');
    expect(result.score).toBeGreaterThan(0);
    expect(next.currentTurnIndex).toBe(1);
    expect(next.consecutivePasses).toBe(0);

    const player = next.players.find((p) => p.gamePlayerId === 'p1')!;
    expect(player.score).toBe(result.score);
    expect(player.rack).toHaveLength(RACK_SIZE); // rechargé à 7
    expect(player.rack).toEqual(expect.arrayContaining(['X', 'Y', 'Z']));
  });

  it('rejects the whole move atomically if the formed word is invalid, without mutating state', () => {
    const state = makeState({ racks: [['C', 'H', 'A', 'T', 'X', 'Y', 'Z']] });
    // Dictionnaire qui ne reconnaît aucun des mots du coup testé, pour vérifier le rejet.
    const badDictionary = createSetDictionary(['AUTRE_MOT_QUELCONQUE']);
    const placements: Placement[] = [
      { row: CENTER, col: CENTER - 1, letter: 'C', isBlank: false },
      { row: CENTER, col: CENTER, letter: 'H', isBlank: false },
      { row: CENTER, col: CENTER + 1, letter: 'A', isBlank: false },
      { row: CENTER, col: CENTER + 2, letter: 'T', isBlank: false },
    ];

    expect(() => applyPlaceMove(state, placements, badDictionary)).toThrow(InvalidMoveError);
    // L'état d'origine (passé par référence) ne doit pas avoir été modifié.
    expect(state.board.cells[CENTER]![CENTER - 1]).toBeNull();
    expect(state.players[0]!.rack).toEqual(['C', 'H', 'A', 'T', 'X', 'Y', 'Z']);
  });

  it('rejects a move using letters not present in the rack', () => {
    const state = makeState({ racks: [['C', 'H', 'A', 'T', 'X', 'Y', 'Z']] });
    const placements: Placement[] = [
      { row: CENTER, col: CENTER, letter: 'Q', isBlank: false }, // Q absent du chevalet
    ];
    expect(() => applyPlaceMove(state, placements, acceptAllDictionary)).toThrow(InvalidMoveError);
  });

  it('rejects a first move that does not cover the center cell', () => {
    const state = makeState({ racks: [['C', 'H', 'A', 'T', 'X', 'Y', 'Z']] });
    const placements: Placement[] = [
      { row: 0, col: 0, letter: 'C', isBlank: false },
      { row: 0, col: 1, letter: 'H', isBlank: false },
    ];
    expect(() => applyPlaceMove(state, placements, acceptAllDictionary)).toThrow(InvalidMoveError);
  });
});

describe('applyExchange', () => {
  it('swaps letters, keeps the same rack size, and passes the turn', () => {
    const state = makeState({ racks: [['A', 'B', 'C', 'D', 'E', 'F', 'G'], ['H', 'I', 'J', 'K', 'L', 'M', 'N']] });
    const { state: next, result } = applyExchange(state, ['A', 'B']);
    expect(result.type).toBe('EXCHANGE');
    expect(result.score).toBe(0);
    expect(next.currentTurnIndex).toBe(1);
    expect(next.consecutivePasses).toBe(1);
    const player = next.players.find((p) => p.gamePlayerId === 'p1')!;
    expect(player.rack).toHaveLength(RACK_SIZE);
  });

  it('refuses to exchange when fewer than 7 letters remain in the bag', () => {
    const state = makeState({ racks: [['A', 'B', 'C', 'D', 'E', 'F', 'G']], bag: ['X', 'Y'] });
    expect(() => applyExchange(state, ['A'])).toThrow(InvalidMoveError);
  });

  it('refuses to exchange letters not present in the rack', () => {
    const state = makeState({ racks: [['A', 'B', 'C', 'D', 'E', 'F', 'G']] });
    expect(() => applyExchange(state, ['Z'])).toThrow(InvalidMoveError);
  });
});

describe('applyPass', () => {
  it('increments consecutivePasses and advances the turn without scoring', () => {
    const state = makeState({ racks: [['A', 'B', 'C', 'D', 'E', 'F', 'G'], ['H', 'I', 'J', 'K', 'L', 'M', 'N']] });
    const { state: next, result } = applyPass(state);
    expect(result.type).toBe('PASS');
    expect(result.score).toBe(0);
    expect(next.consecutivePasses).toBe(1);
    expect(next.currentTurnIndex).toBe(1);
  });

  it('records whether the pass was triggered by a timeout', () => {
    const state = makeState({ racks: [['A', 'B', 'C', 'D', 'E', 'F', 'G']] });
    const { result } = applyPass(state, 'timeout');
    expect(result.triggeredBy).toBe('timeout');
  });
});
