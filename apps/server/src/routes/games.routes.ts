import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createGameSchema, joinGameSchema } from '@scrabble/shared';
import { env } from '../config/env.js';
import { HttpError } from '../errors.js';
import { requireUser } from '../plugins/authContext.js';
import { GUEST_COOKIE_NAME, generateGuestId, getUserById } from '../services/auth.service.js';
import {
  createGame,
  getGameDetailForUser,
  getGamePreview,
  joinGame,
  listMyGames,
  type ActingIdentity,
  type Viewer,
} from '../services/game.service.js';

const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

function currentViewer(request: FastifyRequest): Viewer {
  if (request.identity?.kind === 'user') return { kind: 'user', userId: request.identity.userId };
  if (request.identity?.kind === 'guest') return { kind: 'guest', guestId: request.identity.guestId };
  return null;
}

/** Résout l'identité complète (avec pseudo) de la personne créant/rejoignant une partie. */
async function resolveActingIdentity(
  request: FastifyRequest,
  reply: FastifyReply,
  pseudoInput: string | undefined,
): Promise<ActingIdentity> {
  if (request.identity?.kind === 'user') {
    const user = await getUserById(request.identity.userId);
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Session invalide.');
    return { kind: 'user', userId: user.id, pseudo: user.pseudo };
  }

  if (!pseudoInput) {
    throw new HttpError(400, 'PSEUDO_REQUIRED', 'Un pseudo est requis pour jouer en invité.');
  }

  let guestId = request.identity?.kind === 'guest' ? request.identity.guestId : undefined;
  if (!guestId) {
    guestId = generateGuestId();
    reply.setCookie(GUEST_COOKIE_NAME, guestId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  }
  return { kind: 'guest', guestId, pseudo: pseudoInput };
}

export async function gamesRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', async (request, reply) => {
    const input = createGameSchema.parse(request.body ?? {});
    const identity = await resolveActingIdentity(request, reply, input.pseudo);
    const game = await createGame(identity, input);
    return reply.code(201).send({ game });
  });

  app.get('/mine', async (request) => {
    const { userId } = requireUser(request);
    const games = await listMyGames(userId);
    return { games };
  });

  app.get('/:inviteCode', async (request) => {
    const { inviteCode } = request.params as { inviteCode: string };
    const game = await getGamePreview(inviteCode, currentViewer(request));
    return { game };
  });

  app.post('/:inviteCode/join', async (request, reply) => {
    const { inviteCode } = request.params as { inviteCode: string };
    const input = joinGameSchema.parse(request.body ?? {});
    const identity = await resolveActingIdentity(request, reply, input.pseudo);
    const game = await joinGame(inviteCode, identity);
    return { game };
  });

  app.get('/:id/detail', async (request) => {
    const { userId } = requireUser(request);
    const { id } = request.params as { id: string };
    const game = await getGameDetailForUser(id, userId);
    return { game };
  });
}
