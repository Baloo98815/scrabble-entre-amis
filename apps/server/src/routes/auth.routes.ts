import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from '@scrabble/shared';
import { env } from '../config/env.js';
import { requireUser } from '../plugins/authContext.js';
import { SESSION_COOKIE_NAME, getUserById, login, register } from '../services/auth.service.js';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

function sessionCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE,
    maxAge: SESSION_MAX_AGE,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const { user, token } = await register(input);
    reply.setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return reply.code(201).send({ user });
  });

  app.post('/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const { user, token } = await login(input);
    reply.setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return { user };
  });

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/me', async (request) => {
    const { userId } = requireUser(request);
    const user = await getUserById(userId);
    return { user };
  });
}
