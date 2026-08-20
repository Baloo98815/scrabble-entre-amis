import { Prisma } from '@prisma/client';
import type { GameState, MoveResult } from '@scrabble/shared';
import { prisma } from '../db/prisma.js';

/** Ids de toutes les parties en cours, pour la rehydratation au démarrage du serveur. */
export async function listInProgressGameIds(): Promise<string[]> {
  const games = await prisma.game.findMany({ where: { status: 'IN_PROGRESS' }, select: { id: true } });
  return games.map((g) => g.id);
}

export async function loadGameForRuntime(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { user: { select: { pseudo: true } } }, orderBy: { seat: 'asc' } },
    },
  });
  if (!game) {
    throw new Error(`Partie introuvable: ${gameId}`);
  }
  return game;
}

/** Persiste la mise en route de la partie (distribution des chevalets, sac initial). */
export async function persistGameStart(state: GameState): Promise<void> {
  await prisma.$transaction([
    prisma.game.update({
      where: { id: state.gameId },
      data: {
        status: 'IN_PROGRESS',
        boardState: state.board as unknown as Prisma.InputJsonValue,
        bagState: state.bag as unknown as Prisma.InputJsonValue,
        currentTurnIndex: state.currentTurnIndex,
        consecutivePasses: state.consecutivePasses,
        turnNumber: state.turnNumber,
        startedAt: new Date(),
      },
    }),
    ...state.players.map((p) =>
      prisma.gamePlayer.update({
        where: { id: p.gamePlayerId },
        data: { rack: p.rack as unknown as Prisma.InputJsonValue },
      }),
    ),
  ]);
}

/** Persiste le résultat d'un coup (pose/échange/passe) : état de la partie + historique. */
export async function persistMove(state: GameState, gamePlayerId: string, result: MoveResult): Promise<void> {
  const mover = state.players.find((p) => p.gamePlayerId === gamePlayerId);

  await prisma.$transaction([
    prisma.game.update({
      where: { id: state.gameId },
      data: {
        boardState: state.board as unknown as Prisma.InputJsonValue,
        bagState: state.bag as unknown as Prisma.InputJsonValue,
        currentTurnIndex: state.currentTurnIndex,
        consecutivePasses: state.consecutivePasses,
        turnNumber: state.turnNumber,
        status: state.status,
        finishedAt: state.status === 'FINISHED' ? new Date() : undefined,
      },
    }),
    ...state.players.map((p) =>
      prisma.gamePlayer.update({
        where: { id: p.gamePlayerId },
        data: { rack: p.rack as unknown as Prisma.InputJsonValue, score: p.score },
      }),
    ),
    prisma.move.create({
      data: {
        gameId: state.gameId,
        gamePlayerId,
        turnNumber: result.turnNumber,
        type: result.type,
        tilesPlaced: (result.tilesPlaced ?? undefined) as unknown as Prisma.InputJsonValue,
        wordsFormed: (result.wordsFormed ?? undefined) as unknown as Prisma.InputJsonValue,
        score: result.score,
        rackAfter: (mover?.rack ?? []) as unknown as Prisma.InputJsonValue,
        triggeredBy: result.triggeredBy,
      },
    }),
  ]);
}

export async function setPlayerConnected(gamePlayerId: string, isConnected: boolean): Promise<void> {
  await prisma.gamePlayer.update({ where: { id: gamePlayerId }, data: { isConnected } });
}
