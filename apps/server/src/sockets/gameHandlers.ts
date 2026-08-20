import {
  gameJoinSchema,
  moveExchangeSchema,
  movePlaceSchema,
  type AckFailure,
  type AckResponse,
} from '@scrabble/shared';
import { HttpError } from '../errors.js';
import type { GameRoomManager } from '../game-runtime/GameRoomManager.js';
import { findGamePlayerId } from '../services/game.service.js';
import type { IOServer, IOSocket } from './types.js';

function ok<T>(data: T): AckResponse<T> {
  return { ok: true, data };
}

function fail(code: string, message: string): AckFailure {
  return { ok: false, error: { code, message } };
}

function toAckError(err: unknown): AckFailure {
  if (err instanceof HttpError) return fail(err.code, err.message);
  const message = err instanceof Error ? err.message : 'Erreur inconnue.';
  return fail('INTERNAL_ERROR', message);
}

export function registerGameHandlers(io: IOServer, manager: GameRoomManager): void {
  io.on('connection', (socket: IOSocket) => {
    let joinedGameId: string | null = null;
    let joinedGamePlayerId: string | null = null;

    socket.on('game:join', async (input, ack) => {
      try {
        const { gameId } = gameJoinSchema.parse(input);
        const gamePlayerId = await findGamePlayerId(gameId, socket.data.identity);
        if (!gamePlayerId) {
          ack(fail('NOT_A_PLAYER', 'Vous ne faites pas partie de cette partie.'));
          return;
        }
        const room = await manager.getOrLoad(gameId);
        const payload = await room.attachSocket(socket, gamePlayerId);
        joinedGameId = gameId;
        joinedGamePlayerId = gamePlayerId;
        ack(ok(payload));
      } catch (err) {
        ack(toAckError(err));
      }
    });

    socket.on('game:start', async (ack) => {
      try {
        if (!joinedGameId || !joinedGamePlayerId) {
          throw new HttpError(400, 'NOT_JOINED', "Rejoignez d'abord la partie (game:join).");
        }
        const room = await manager.getOrLoad(joinedGameId);
        const payload = await room.start(joinedGamePlayerId);
        ack(ok(payload));
      } catch (err) {
        ack(toAckError(err));
      }
    });

    socket.on('move:place', async (input, ack) => {
      try {
        if (!joinedGameId || !joinedGamePlayerId) {
          throw new HttpError(400, 'NOT_JOINED', "Rejoignez d'abord la partie (game:join).");
        }
        const { placements } = movePlaceSchema.parse(input);
        const room = await manager.getOrLoad(joinedGameId);
        const payload = await room.placeMove(joinedGamePlayerId, placements);
        ack(ok(payload));
      } catch (err) {
        ack(toAckError(err));
      }
    });

    socket.on('move:exchange', async (input, ack) => {
      try {
        if (!joinedGameId || !joinedGamePlayerId) {
          throw new HttpError(400, 'NOT_JOINED', "Rejoignez d'abord la partie (game:join).");
        }
        const { letters } = moveExchangeSchema.parse(input);
        const room = await manager.getOrLoad(joinedGameId);
        const payload = await room.exchange(joinedGamePlayerId, letters);
        ack(ok(payload));
      } catch (err) {
        ack(toAckError(err));
      }
    });

    socket.on('move:pass', async (ack) => {
      try {
        if (!joinedGameId || !joinedGamePlayerId) {
          throw new HttpError(400, 'NOT_JOINED', "Rejoignez d'abord la partie (game:join).");
        }
        const room = await manager.getOrLoad(joinedGameId);
        const payload = await room.pass(joinedGamePlayerId);
        ack(ok(payload));
      } catch (err) {
        ack(toAckError(err));
      }
    });

    socket.on('game:leave', async (ack) => {
      try {
        if (joinedGameId) {
          const room = manager.get(joinedGameId);
          if (room) await room.detachSocket(socket);
          await socket.leave(`game:${joinedGameId}`);
        }
        joinedGameId = null;
        joinedGamePlayerId = null;
        ack(ok(null));
      } catch (err) {
        ack(toAckError(err));
      }
    });

    socket.on('disconnect', () => {
      if (!joinedGameId) return;
      const room = manager.get(joinedGameId);
      if (!room) return;
      void room.detachSocket(socket).then(() => {
        if (room.state.status === 'FINISHED') manager.sweepIfIdle(joinedGameId!);
      });
    });
  });
}
