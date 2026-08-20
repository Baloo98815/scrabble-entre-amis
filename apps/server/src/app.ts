import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { HttpError } from './errors.js';
import { registerAuthContext } from './plugins/authContext.js';
import { adminDictionaryRoutes, dictionaryRoutes } from './routes/dictionary.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { gamesRoutes } from './routes/games.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });

  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(cookie);
  registerAuthContext(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Requête invalide.',
          issues: error.issues,
        },
      });
    }
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    app.log.error(error);
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur est survenue.' } });
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(gamesRoutes, { prefix: '/api/games' });
  await app.register(dictionaryRoutes, { prefix: '/api/dictionary' });
  await app.register(adminDictionaryRoutes, { prefix: '/api/admin/dictionary' });

  return app;
}
