import { Prisma } from '@prisma/client';
import { RACK_SIZE, type GameState, type MoveResult } from '@scrabble/shared';
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
      moves: {
        orderBy: { turnNumber: 'asc' },
        select: { turnNumber: true, gamePlayerId: true, type: true, wordsFormed: true, score: true, triggeredBy: true },
      },
    },
  });
  if (!game) {
    throw new Error(`Partie introuvable: ${gameId}`);
  }
  return game;
}

/** Marque la partie comme terminée sans coup (clôture manuelle par le créateur). */
export async function persistGameClosed(gameId: string): Promise<void> {
  await prisma.game.update({ where: { id: gameId }, data: { status: 'FINISHED', finishedAt: new Date() } });
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
        isBingo: result.type === 'PLACE' && (result.tilesPlaced?.length ?? 0) === RACK_SIZE,
        rackAfter: (mover?.rack ?? []) as unknown as Prisma.InputJsonValue,
        triggeredBy: result.triggeredBy,
      },
    }),
  ]);
}

export async function setPlayerConnected(gamePlayerId: string, isConnected: boolean): Promise<void> {
  await prisma.gamePlayer.update({ where: { id: gamePlayerId }, data: { isConnected } });
}

/**
 * Scrabbullshit : enregistre un « +1 » (événement pour les stats/succès) et le score de l'auteur
 * du mot dans la même transaction, pour que les deux ne divergent jamais.
 */
export async function persistBonusClick(params: {
  gameId: string;
  turnNumber: number;
  word: string;
  fromPlayerId: string;
  toPlayerId: string;
  points: number;
  authorScore: number;
}): Promise<void> {
  await prisma.$transaction([
    prisma.bonusClick.create({
      data: {
        gameId: params.gameId,
        turnNumber: params.turnNumber,
        word: params.word,
        fromPlayerId: params.fromPlayerId,
        toPlayerId: params.toPlayerId,
        points: params.points,
      },
    }),
    prisma.gamePlayer.update({ where: { id: params.toPlayerId }, data: { score: params.authorScore } }),
  ]);
}

/**
 * Scrabbullshit : trace d'une proposition de mot, de sa création à son issue. Ces écritures sont
 * best-effort (statistiques) : une erreur est loguée mais ne doit jamais bloquer la partie.
 */
function bestEffort(label: string, op: Promise<unknown>): Promise<void> {
  return op.then(
    () => undefined,
    (err: unknown) => {
      console.error(`[${label}] enregistrement impossible :`, err);
    },
  );
}

export function persistProposalCreated(params: { id: string; gameId: string; proposerId: string; word: string }): Promise<void> {
  return bestEffort('persistProposalCreated', prisma.wordProposal.create({ data: { ...params, outcome: 'PENDING' } }));
}

export function persistProposalVote(params: { proposalId: string; voterId: string; accept: boolean }): Promise<void> {
  return bestEffort('persistProposalVote', prisma.proposalVote.create({ data: params }));
}

export function persistProposalResolved(id: string, outcome: 'ACCEPTED' | 'REJECTED' | 'CANCELLED'): Promise<void> {
  return bestEffort(
    'persistProposalResolved',
    prisma.wordProposal.update({ where: { id }, data: { outcome, resolvedAt: new Date() } }),
  );
}

/** Scrabbullshit : persiste les mots acceptés à l'unanimité pour cette partie. */
export async function persistExtraWords(gameId: string, extraWords: string[]): Promise<void> {
  await prisma.game.update({ where: { id: gameId }, data: { extraWords } });
}
