import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { GameRoomManager } from './game-runtime/GameRoomManager.js';
import { registerSocketAuth } from './sockets/authMiddleware.js';
import { registerGameHandlers } from './sockets/gameHandlers.js';
import type { IOServer } from './sockets/types.js';
import { dictionaryChecker } from './services/dictionary.service.js';

/** Attache Socket.IO au serveur HTTP de Fastify et recharge les parties en cours. */
export async function attachRealtime(app: FastifyInstance): Promise<GameRoomManager> {
  const io: IOServer = new SocketIOServer(app.server, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  registerSocketAuth(io);
  const manager = new GameRoomManager(io, dictionaryChecker);
  registerGameHandlers(io, manager);

  const rehydrated = await manager.rehydrateInProgressGames();
  app.log.info(`Parties en cours rechargées depuis la base : ${rehydrated}`);

  return manager;
}
