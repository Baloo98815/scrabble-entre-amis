import type { CreateGameInput, GamePlayerSummary, GameSummary } from '@scrabble/shared';
import type { Game, GamePlayer, User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors.js';
import { getGameRoomManager } from '../game-runtime/registry.js';
import { persistGameClosed } from './persistence.service.js';

/** Qui regarde/agit - juste de quoi identifier "est-ce moi ?" parmi les joueurs d'une partie. */
export type Viewer = { kind: 'user'; userId: string } | { kind: 'guest'; guestId: string } | null;

/** Identité complète de la personne qui crée ou rejoint une partie (avec le pseudo choisi). */
export type ActingIdentity =
  | { kind: 'user'; userId: string; pseudo: string }
  | { kind: 'guest'; guestId: string; pseudo: string };

type GameWithPlayers = Game & { players: (GamePlayer & { user: Pick<User, 'pseudo'> | null })[] };

const PLAYER_INCLUDE = { players: { include: { user: { select: { pseudo: true } } } } } as const;

function playerPseudo(p: { user: Pick<User, 'pseudo'> | null; guestName: string | null }): string {
  return p.user?.pseudo ?? p.guestName ?? 'Joueur';
}

function isSamePlayer(p: GamePlayer, viewer: Viewer): boolean {
  if (!viewer) return false;
  return viewer.kind === 'user' ? p.userId === viewer.userId : p.guestId === viewer.guestId;
}

function toGameSummary(game: GameWithPlayers, viewer: Viewer): GameSummary {
  const players: GamePlayerSummary[] = game.players
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({
      gamePlayerId: p.id,
      pseudo: playerPseudo(p),
      seat: p.seat,
      score: p.score,
      isConnected: p.isConnected,
      isYou: isSamePlayer(p, viewer),
    }));

  return {
    id: game.id,
    inviteCode: game.inviteCode,
    status: game.status,
    mode: game.mode,
    maxPlayers: game.maxPlayers,
    turnTimeoutSeconds: game.turnTimeoutSeconds,
    createdAt: game.createdAt.toISOString(),
    players,
  };
}

export async function createGame(creator: ActingIdentity, input: CreateGameInput): Promise<GameSummary> {
  const game = await prisma.game.create({
    data: {
      mode: input.mode,
      maxPlayers: input.maxPlayers,
      turnTimeoutSeconds: input.turnTimeoutSeconds ?? null,
      players: {
        create: {
          seat: 0,
          userId: creator.kind === 'user' ? creator.userId : undefined,
          guestId: creator.kind === 'guest' ? creator.guestId : undefined,
          guestName: creator.kind === 'guest' ? creator.pseudo : undefined,
        },
      },
    },
    include: PLAYER_INCLUDE,
  });
  return toGameSummary(game, creator);
}

async function findGameByInviteCodeOrThrow(inviteCode: string): Promise<GameWithPlayers> {
  const game = await prisma.game.findUnique({ where: { inviteCode }, include: PLAYER_INCLUDE });
  if (!game) {
    throw new HttpError(404, 'GAME_NOT_FOUND', 'Partie introuvable pour ce lien.');
  }
  return game;
}

export async function getGamePreview(inviteCode: string, viewer: Viewer): Promise<GameSummary> {
  const game = await findGameByInviteCodeOrThrow(inviteCode);
  return toGameSummary(game, viewer);
}

export async function joinGame(inviteCode: string, joiner: ActingIdentity): Promise<GameSummary> {
  const game = await findGameByInviteCodeOrThrow(inviteCode);

  const existingPlayer = game.players.find((p) => isSamePlayer(p, joiner));
  if (existingPlayer) {
    return toGameSummary(game, joiner);
  }

  if (game.status !== 'WAITING') {
    throw new HttpError(409, 'GAME_ALREADY_STARTED', 'Cette partie a déjà démarré.');
  }
  if (game.players.length >= game.maxPlayers) {
    throw new HttpError(409, 'GAME_FULL', 'Cette partie est complète.');
  }

  const nextSeat = Math.max(-1, ...game.players.map((p) => p.seat)) + 1;
  await prisma.gamePlayer.create({
    data: {
      gameId: game.id,
      seat: nextSeat,
      userId: joiner.kind === 'user' ? joiner.userId : undefined,
      guestId: joiner.kind === 'guest' ? joiner.guestId : undefined,
      guestName: joiner.kind === 'guest' ? joiner.pseudo : undefined,
    },
  });

  const updated = await findGameByInviteCodeOrThrow(inviteCode);
  return toGameSummary(updated, joiner);
}

export async function listMyGames(userId: string): Promise<GameSummary[]> {
  const games = await prisma.game.findMany({
    where: { players: { some: { userId } } },
    include: PLAYER_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
  return games.map((g) => toGameSummary(g, { kind: 'user', userId }));
}

/**
 * Clôture une partie en attente ou en cours (→ FINISHED) pour qu'elle ne soit plus proposée comme
 * « partie en cours ». Réservé au créateur ; sans effet sur une partie déjà terminée. Si la partie
 * est chargée en mémoire, c'est la `GameRoom` qui la clôt (timer, clients, base) pour éviter qu'un
 * coup ou le timer n'écrase le statut.
 */
export async function closeGame(gameId: string, userId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { status: true, players: { select: { userId: true, seat: true } } },
  });
  const me = game?.players.find((p) => p.userId === userId);
  if (!game || !me) {
    throw new HttpError(404, 'GAME_NOT_FOUND', 'Partie introuvable.');
  }
  if (game.status === 'FINISHED' || game.status === 'ABANDONED') return;
  if (me.seat !== 0) {
    throw new HttpError(403, 'FORBIDDEN', 'Seul le créateur de la partie peut la clôturer.');
  }
  const room = getGameRoomManager()?.get(gameId);
  if (room) {
    await room.close();
  } else {
    await persistGameClosed(gameId);
  }
}

/** Parties non terminées (en attente ou en cours) où cette identité - compte ou invité - est joueur. */
export async function listActiveGames(viewer: Viewer): Promise<GameSummary[]> {
  if (!viewer) return [];
  const games = await prisma.game.findMany({
    where: {
      status: { in: ['WAITING', 'IN_PROGRESS'] },
      players: { some: viewer.kind === 'user' ? { userId: viewer.userId } : { guestId: viewer.guestId } },
    },
    include: PLAYER_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
  return games.map((g) => toGameSummary(g, viewer));
}

/** Résout le `gamePlayerId` correspondant à cette identité pour cette partie (socket auth). */
export async function findGamePlayerId(gameId: string, viewer: Viewer): Promise<string | null> {
  if (!viewer) return null;
  const player = await prisma.gamePlayer.findFirst({
    where: {
      gameId,
      ...(viewer.kind === 'user' ? { userId: viewer.userId } : { guestId: viewer.guestId }),
    },
    select: { id: true },
  });
  return player?.id ?? null;
}

export async function getGameDetailForUser(gameId: string, userId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      ...PLAYER_INCLUDE,
      moves: { orderBy: { turnNumber: 'asc' } },
    },
  });
  if (!game) {
    throw new HttpError(404, 'GAME_NOT_FOUND', 'Partie introuvable.');
  }
  const belongsToUser = game.players.some((p) => p.userId === userId);
  if (!belongsToUser) {
    throw new HttpError(403, 'FORBIDDEN', "Cette partie ne fait pas partie de ton historique.");
  }
  return {
    ...toGameSummary(game, { kind: 'user', userId }),
    // rackAfter reste en base (reprise/audit) mais n'est jamais exposé : il révélerait le chevalet
    // des adversaires dans une partie en cours.
    moves: game.moves.map(({ rackAfter: _rackAfter, ...move }) => move),
  };
}
