import { describe, expect, it } from 'vitest';
import type { MoveResult, PlayerPublicState } from '@scrabble/shared';
import { deriveMoveSummary } from './deriveMoveSummary.js';

function player(overrides: Partial<PlayerPublicState> & Pick<PlayerPublicState, 'gamePlayerId'>): PlayerPublicState {
  return { pseudo: 'Inconnu', seat: 0, score: 0, rackCount: 7, connected: true, isYou: false, ...overrides };
}

describe('deriveMoveSummary', () => {
  const players = [player({ gamePlayerId: 'p1', pseudo: 'Alice' }), player({ gamePlayerId: 'p2', pseudo: 'Bob' })];

  it('extracts the words and score for a PLACE move', () => {
    const move: MoveResult = {
      type: 'PLACE',
      gamePlayerId: 'p1',
      turnNumber: 3,
      tilesPlaced: [],
      wordsFormed: [
        { word: 'CHAT', score: 12, cells: [] },
        { word: 'AS', score: 4, cells: [] },
      ],
      score: 16,
      triggeredBy: 'player',
    };
    expect(deriveMoveSummary(move, players)).toEqual({
      turnNumber: 3,
      gamePlayerId: 'p1',
      pseudo: 'Alice',
      type: 'PLACE',
      words: ['CHAT', 'AS'],
      score: 16,
      triggeredBy: 'player',
    });
  });

  it('returns an empty word list for a PASS or EXCHANGE move', () => {
    const move: MoveResult = {
      type: 'PASS',
      gamePlayerId: 'p2',
      turnNumber: 4,
      tilesPlaced: null,
      wordsFormed: null,
      score: 0,
      triggeredBy: 'timeout',
    };
    const summary = deriveMoveSummary(move, players);
    expect(summary.words).toEqual([]);
    expect(summary.pseudo).toBe('Bob');
    expect(summary.triggeredBy).toBe('timeout');
  });

  it('falls back to a placeholder pseudo when the player is unknown', () => {
    const move: MoveResult = {
      type: 'PASS',
      gamePlayerId: 'ghost',
      turnNumber: 1,
      tilesPlaced: null,
      wordsFormed: null,
      score: 0,
      triggeredBy: 'player',
    };
    expect(deriveMoveSummary(move, players).pseudo).toBe('Joueur');
  });
});
