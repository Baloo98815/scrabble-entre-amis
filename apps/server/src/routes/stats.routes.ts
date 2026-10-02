import type { FastifyInstance } from 'fastify';
import { requireUser } from '../plugins/authContext.js';
import { getUserStats } from '../services/stats.service.js';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  /** Statistiques cumulées du joueur connecté (succès à venir). */
  app.get('/me', async (request) => {
    const { userId } = requireUser(request);
    return { stats: await getUserStats(userId) };
  });
}
