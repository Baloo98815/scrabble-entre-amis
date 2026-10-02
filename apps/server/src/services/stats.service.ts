import type { Placement, WordFormed } from '@scrabble/shared';
import { prisma } from '../db/prisma.js';
import { computeStats, type PlayerStats } from './stats.compute.js';

export type { PlayerStats };

/**
 * Statistiques cumulées d'un joueur avec compte, toutes parties confondues. Calculées à la
 * demande depuis les événements enregistrés (coups, +1, propositions, votes) : pas de compteurs
 * à maintenir, donc pas de dérive possible, et tout futur succès pourra s'en servir.
 */
export async function getUserStats(userId: string): Promise<PlayerStats> {
  const mine = await prisma.gamePlayer.findMany({ where: { userId }, select: { id: true, gameId: true } });
  const myIds = mine.map((s) => s.id);
  const gameIds = [...new Set(mine.map((s) => s.gameId))];

  const [games, seats, moves, bonusClicks, proposals, votes] = await Promise.all([
    prisma.game.findMany({
      where: { id: { in: gameIds } },
      select: { id: true, status: true, startedAt: true, finishedAt: true },
    }),
    prisma.gamePlayer.findMany({
      where: { gameId: { in: gameIds } },
      select: { id: true, gameId: true, userId: true, guestId: true, guestName: true, score: true, user: { select: { pseudo: true } } },
    }),
    prisma.move.findMany({
      where: { gameId: { in: gameIds } },
      select: {
        gameId: true,
        gamePlayerId: true,
        turnNumber: true,
        type: true,
        score: true,
        isBingo: true,
        tilesPlaced: true,
        wordsFormed: true,
        triggeredBy: true,
        createdAt: true,
      },
    }),
    prisma.bonusClick.findMany({
      where: { OR: [{ toPlayerId: { in: myIds } }, { fromPlayerId: { in: myIds } }] },
      select: { gameId: true, turnNumber: true, word: true, fromPlayerId: true, toPlayerId: true, points: true },
    }),
    prisma.wordProposal.findMany({ where: { proposerId: { in: myIds } }, select: { proposerId: true, outcome: true } }),
    prisma.proposalVote.findMany({ where: { voterId: { in: myIds } }, select: { voterId: true, accept: true } }),
  ]);

  return computeStats({
    userId,
    games,
    seats: seats.map((s) => ({
      id: s.id,
      gameId: s.gameId,
      userId: s.userId,
      guestId: s.guestId,
      pseudo: s.user?.pseudo ?? s.guestName ?? 'Joueur',
      score: s.score,
    })),
    moves: moves.map((m) => ({
      ...m,
      tilesPlaced: m.tilesPlaced as Placement[] | null,
      wordsFormed: m.wordsFormed as WordFormed[] | null,
    })),
    bonusClicks,
    proposals,
    votes,
  });
}
