import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { buildApp } from '../app.js';
import { attachRealtime } from '../realtime.js';
import { prisma } from '../db/prisma.js';
import { loadDictionaryCache } from '../services/dictionary.service.js';

describe('realtime (Socket.IO end-to-end)', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  const createdGameIds: string[] = [];

  beforeAll(async () => {
    await loadDictionaryCache();
    app = await buildApp();
    await app.ready();
    await attachRealtime(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error("Impossible de déterminer le port d'écoute du serveur de test.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
    await app.close();
  });

  function extractCookie(response: Response, name: string): string {
    const raw = response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
    if (!raw) throw new Error(`Cookie ${name} absent de la réponse.`);
    return raw.split(';')[0]!;
  }

  function connectClient(cookie: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(baseUrl, {
        extraHeaders: { cookie },
        forceNew: true,
        transports: ['websocket'],
      });
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  function emitWithAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
    return new Promise((resolve) => {
      socket.emit(event, ...args, (res: T) => resolve(res));
    });
  }

  it('lets two guests join over websocket, start the game, and enforces turn order', async () => {
    const createResponse = await fetch(`${baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxPlayers: 2, pseudo: 'Alice' }),
    });
    const aliceCookie = extractCookie(createResponse, 'scrabble_guest');
    const createBody = (await createResponse.json()) as { game: { id: string; inviteCode: string } };
    const game = createBody.game;
    createdGameIds.push(game.id);

    const joinResponse = await fetch(`${baseUrl}/api/games/${game.inviteCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo: 'Bob' }),
    });
    const bobCookie = extractCookie(joinResponse, 'scrabble_guest');

    const aliceSocket = await connectClient(aliceCookie);
    const bobSocket = await connectClient(bobCookie);

    try {
      const aliceJoinAck = await emitWithAck<{ ok: boolean; data?: { status: string } }>(
        aliceSocket,
        'game:join',
        { gameId: game.id },
      );
      expect(aliceJoinAck.ok).toBe(true);
      expect(aliceJoinAck.data?.status).toBe('WAITING');

      const bobJoinAck = await emitWithAck<{ ok: boolean }>(bobSocket, 'game:join', { gameId: game.id });
      expect(bobJoinAck.ok).toBe(true);

      const startedPromise = new Promise((resolve) => bobSocket.once('game:started', resolve));

      const startAck = await emitWithAck<{ ok: boolean; data?: { status: string; yourRack: string[] } }>(
        aliceSocket,
        'game:start',
      );
      expect(startAck.ok).toBe(true);
      expect(startAck.data?.status).toBe('IN_PROGRESS');
      expect(startAck.data?.yourRack).toHaveLength(7);

      await startedPromise;

      const bobPassTooEarly = await emitWithAck<{ ok: boolean; error?: { code: string } }>(bobSocket, 'move:pass');
      expect(bobPassTooEarly.ok).toBe(false);
      expect(bobPassTooEarly.error?.code).toBe('NOT_YOUR_TURN');

      const alicePass = await emitWithAck<{ ok: boolean; data?: { nextTurnIndex: number } }>(
        aliceSocket,
        'move:pass',
      );
      expect(alicePass.ok).toBe(true);
      expect(alicePass.data?.nextTurnIndex).toBe(1);
    } finally {
      aliceSocket.disconnect();
      bobSocket.disconnect();
    }
  });
});
