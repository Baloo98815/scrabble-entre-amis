import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError } from '../errors.js';
import { GUEST_COOKIE_NAME, SESSION_COOKIE_NAME, verifySession } from '../services/auth.service.js';

export type Identity =
  | { kind: 'user'; userId: string; isAdmin: boolean }
  | { kind: 'guest'; guestId: string }
  | null;

declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity;
  }
}

/**
 * Lit le cookie de session (JWT) ou le cookie invité et attache `request.identity`.
 * Doit être enregistré APRÈS @fastify/cookie, à la racine de l'app (les hooks racine
 * s'appliquent à toutes les routes, y compris celles des plugins enfants).
 */
export function registerAuthContext(app: FastifyInstance): void {
  app.decorateRequest('identity', null);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    if (sessionToken) {
      const payload = verifySession(sessionToken);
      if (payload) {
        request.identity = { kind: 'user', userId: payload.sub, isAdmin: payload.isAdmin };
        return;
      }
    }
    const guestId = request.cookies[GUEST_COOKIE_NAME];
    if (guestId) {
      request.identity = { kind: 'guest', guestId };
    }
  });
}

export function requireUser(request: FastifyRequest): { userId: string; isAdmin: boolean } {
  if (request.identity?.kind !== 'user') {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentification requise.');
  }
  return { userId: request.identity.userId, isAdmin: request.identity.isAdmin };
}

export function requireAdmin(request: FastifyRequest): { userId: string } {
  const user = requireUser(request);
  if (!user.isAdmin) {
    throw new HttpError(403, 'FORBIDDEN', 'Réservé aux administrateurs.');
  }
  return user;
}
