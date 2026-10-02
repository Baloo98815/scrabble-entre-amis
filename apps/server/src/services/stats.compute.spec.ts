import { describe, expect, it } from 'vitest';
import { computeStats, type StatsInput, type StatsMove } from './stats.compute.js';

const t = (min: number) => new Date(Date.UTC(2026, 0, 1, 12, min));

function move(over: Partial<StatsMove> & Pick<StatsMove, 'gameId' | 'gamePlayerId' | 'turnNumber'>): StatsMove {
  return {
    type: 'PLACE',
    score: 0,
    isBingo: false,
    tilesPlaced: null,
    wordsFormed: null,
    triggeredBy: 'player',
    createdAt: t(over.turnNumber),
    ...over,
  };
}

const input: StatsInput = {
  userId: 'U',
  games: [
    { id: 'g1', status: 'FINISHED', startedAt: t(-1), finishedAt: t(10) },
    { id: 'g2', status: 'FINISHED', startedAt: t(20), finishedAt: t(30) },
    { id: 'g3', status: 'WAITING', startedAt: null, finishedAt: null },
  ],
  seats: [
    { id: 'a1', gameId: 'g1', userId: 'U', guestId: null, pseudo: 'Moi', score: 300 },
    { id: 'b1', gameId: 'g1', userId: 'B', guestId: null, pseudo: 'Bob', score: 200 },
    { id: 'a2', gameId: 'g2', userId: 'U', guestId: null, pseudo: 'Moi', score: 90 },
    { id: 'b2', gameId: 'g2', userId: 'B', guestId: null, pseudo: 'Bob', score: 100 },
    { id: 'a3', gameId: 'g3', userId: 'U', guestId: null, pseudo: 'Moi', score: 0 },
  ],
  moves: [
    move({ gameId: 'g1', gamePlayerId: 'b1', turnNumber: 0, score: 50 }),
    move({
      gameId: 'g1',
      gamePlayerId: 'a1',
      turnNumber: 1,
      score: 20,
      tilesPlaced: [
        { row: 0, col: 0, letter: 'Q', isBlank: false },
        { row: 1, col: 1, letter: 'A', isBlank: true },
      ],
      wordsFormed: [{ word: 'QUAI', score: 20, cells: [] }],
    }),
    move({ gameId: 'g1', gamePlayerId: 'b1', turnNumber: 2, score: 60 }),
    move({
      gameId: 'g1',
      gamePlayerId: 'a1',
      turnNumber: 3,
      score: 100,
      isBingo: true,
      wordsFormed: [{ word: 'CHEVAUX', score: 100, cells: [] }],
    }),
    move({ gameId: 'g1', gamePlayerId: 'a1', turnNumber: 4, type: 'PASS', triggeredBy: 'timeout' }),
    move({ gameId: 'g1', gamePlayerId: 'a1', turnNumber: 5, type: 'EXCHANGE' }),
  ],
  bonusClicks: [
    { gameId: 'g1', turnNumber: 3, word: 'CHEVAUX', fromPlayerId: 'b1', toPlayerId: 'a1', points: 1 },
    { gameId: 'g1', turnNumber: 1, word: 'QUAI', fromPlayerId: 'a1', toPlayerId: 'b1', points: 1 },
  ],
  proposals: [
    { proposerId: 'a1', outcome: 'ACCEPTED' },
    { proposerId: 'a2', outcome: 'REJECTED' },
    { proposerId: 'a2', outcome: 'PENDING' },
  ],
  votes: [
    { voterId: 'a1', accept: true },
    { voterId: 'a2', accept: false },
  ],
};

describe('computeStats', () => {
  const stats = computeStats(input);

  it('compte les parties démarrées, terminées, gagnées et les séries', () => {
    expect(stats.games).toMatchObject({ played: 2, finished: 2, won: 1, winRate: 0.5, currentWinStreak: 0, bestWinStreak: 1 });
  });

  it('calcule scores, coups et style de jeu', () => {
    expect(stats.scores.averageGameScore).toBe(195);
    expect(stats.scores.bestGameScore).toBe(300);
    expect(stats.scores.bestMove).toEqual({ score: 100, word: 'CHEVAUX' });
    expect(stats.play).toMatchObject({ bingos: 1, passes: 0, timeoutPasses: 1, exchanges: 1, blanksPlayed: 1 });
  });

  it('analyse mots, lettres rares et cases bonus', () => {
    expect(stats.words.longest).toBe('CHEVAUX');
    expect(stats.words.bestScoring).toEqual({ word: 'CHEVAUX', score: 100 });
    expect(stats.words.rareLetters.Q).toBe(1);
    expect(stats.premiums).toEqual({ tripleWord: 1, doubleWord: 1, multiPremiumMoves: 1 });
  });

  it('agrège +1, propositions et votes', () => {
    expect(stats.scrabbullshit).toMatchObject({
      bonusGiven: 1,
      bonusReceived: 1,
      bonusPointsReceived: 1,
      generosityRatio: 1,
      mostApplaudedWord: { word: 'CHEVAUX', clicks: 1 },
      proposalsMade: 2,
      proposalsAccepted: 1,
      proposalsRejected: 1,
      acceptanceRate: 0.5,
      votesCast: 2,
      votesAccepted: 1,
      votesRejected: 1,
    });
  });

  it('établit le bilan par adversaire', () => {
    expect(stats.headToHead).toEqual([
      { opponent: { pseudo: 'Bob', userId: 'B' }, games: 2, wins: 1, losses: 1, draws: 0 },
    ]);
  });

  it('mesure le plus gros retard rattrapé avant une victoire', () => {
    // b = 110 contre a = 20 après le tour 2 : 90 points de retard avant la victoire finale.
    expect(stats.comeback.biggestDeficitOvercome).toBe(90);
  });

  it('calcule le délai médian de réflexion sur les coups joués par le joueur', () => {
    // Tour 1 : 1 min après le tour 0 ; tour 3 : 1 min après le tour 2 ; tour 5 : 1 min (tour 4 timeout exclu).
    expect(stats.pace.medianThinkSeconds).toBe(60);
  });

  it('renvoie des valeurs neutres sans aucune partie', () => {
    const empty = computeStats({ ...input, seats: [], games: [], moves: [], bonusClicks: [], proposals: [], votes: [] });
    expect(empty.games.played).toBe(0);
    expect(empty.scores.averageGameScore).toBeNull();
    expect(empty.headToHead).toEqual([]);
  });
});
