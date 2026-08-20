import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { acceptAllDictionary } from '@scrabble/shared';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors.js';
import type { IOServer, IOSocket } from '../sockets/types.js';
import { GameRoom } from './GameRoom.js';

function stubIO(): { io: IOServer; emitted: Array<{ event: string; payload: unknown }> } {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const io = {
    to: () => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ event, payload });
      },
    }),
  } as unknown as IOServer;
  return { io, emitted };
}

function stubSocket(): IOSocket {
  return {
    join: async () => undefined,
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  } as unknown as IOSocket;
}

async function createTestGame(turnTimeoutSeconds: number | null = null): Promise<{
  gameId: string;
  aliceId: string;
  bobId: string;
}> {
  const game = await prisma.game.create({
    data: {
      maxPlayers: 2,
      turnTimeoutSeconds,
      players: {
        create: [
          { seat: 0, guestId: randomUUID(), guestName: 'Alice' },
          { seat: 1, guestId: randomUUID(), guestName: 'Bob' },
        ],
      },
    },
    include: { players: true },
  });
  const alice = game.players.find((p) => p.seat === 0)!;
  const bob = game.players.find((p) => p.seat === 1)!;
  return { gameId: game.id, aliceId: alice.id, bobId: bob.id };
}

describe('GameRoom', () => {
  const createdGameIds: string[] = [];

  afterAll(async () => {
    await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
  });

  it('deals full racks on start and requires the creator (seat 0)', async () => {
    const { gameId, aliceId, bobId } = await createTestGame();
    createdGameIds.push(gameId);
    const { io } = stubIO();
    const room = await GameRoom.load(io, acceptAllDictionary, gameId);

    await expect(room.start(bobId)).rejects.toThrow(HttpError);

    const payload = await room.start(aliceId);
    expect(payload.status).toBe('IN_PROGRESS');
    expect(payload.yourRack).toHaveLength(7);

    const dbGame = await prisma.game.findUniqueOrThrow({ where: { id: gameId }, include: { players: true } });
    expect(dbGame.status).toBe('IN_PROGRESS');
    for (const player of dbGame.players) {
      expect((player.rack as unknown[]).length).toBe(7);
    }
  });

  it('picks up a player who joined via REST after the room was already cached in memory', async () => {
    const game = await prisma.game.create({
      data: {
        maxPlayers: 2,
        players: { create: [{ seat: 0, guestId: randomUUID(), guestName: 'Alice' }] },
      },
      include: { players: true },
    });
    createdGameIds.push(game.id);
    const aliceId = game.players[0]!.id;

    const { io } = stubIO();
    // Charge la partie (roster : Alice seule) — comme le ferait GameRoomManager au 1er join,
    // puis la garde en cache pour tous les joins suivants.
    const room = await GameRoom.load(io, acceptAllDictionary, game.id);
    await room.attachSocket(stubSocket(), aliceId);

    // Simule un POST /games/:code/join REST créant Bob APRÈS que cette instance a été chargée.
    const bob = await prisma.gamePlayer.create({
      data: { gameId: game.id, seat: 1, guestId: randomUUID(), guestName: 'Bob' },
    });

    // Sans le correctif (resynchronisation du roster WAITING), ceci lève NOT_A_PLAYER.
    const payload = await room.attachSocket(stubSocket(), bob.id);
    expect(payload.players).toHaveLength(2);
    expect(payload.players.some((p) => p.pseudo === 'Bob')).toBe(true);
  });

  it('enforces turn order', async () => {
    const { gameId, aliceId, bobId } = await createTestGame();
    createdGameIds.push(gameId);
    const { io } = stubIO();
    const room = await GameRoom.load(io, acceptAllDictionary, gameId);
    await room.start(aliceId);

    await expect(room.pass(bobId)).rejects.toThrow(HttpError);

    const result = await room.pass(aliceId);
    expect(result.nextTurnIndex).toBe(1);
    expect(room.state.currentTurnIndex).toBe(1);
  });

  it('ends the game by stalemate after 2x the player count of consecutive passes', async () => {
    const { gameId, aliceId, bobId } = await createTestGame();
    createdGameIds.push(gameId);
    const { io, emitted } = stubIO();
    const room = await GameRoom.load(io, acceptAllDictionary, gameId);
    await room.start(aliceId);

    await room.pass(aliceId);
    await room.pass(bobId);
    await room.pass(aliceId);
    await room.pass(bobId);

    expect(room.state.status).toBe('FINISHED');
    const ended = emitted.find((e) => e.event === 'game:ended');
    expect(ended).toBeDefined();
    expect((ended!.payload as { reason: string }).reason).toBe('stalemate');
    expect((ended!.payload as { finalScores: unknown[] }).finalScores).toHaveLength(2);
  });

  it('rehydrates an in-progress game identically after a simulated server restart', async () => {
    const { gameId, aliceId, bobId } = await createTestGame();
    createdGameIds.push(gameId);
    const { io } = stubIO();
    const roomBeforeRestart = await GameRoom.load(io, acceptAllDictionary, gameId);
    await roomBeforeRestart.start(aliceId);
    await roomBeforeRestart.pass(aliceId);

    // Simule un redémarrage : nouvelle instance io, nouveau GameRoom rechargé depuis la DB
    // (aucun état en mémoire partagé avec `roomBeforeRestart`).
    const { io: freshIo } = stubIO();
    const roomAfterRestart = await GameRoom.load(freshIo, acceptAllDictionary, gameId);

    expect(roomAfterRestart.state.status).toBe('IN_PROGRESS');
    expect(roomAfterRestart.state.currentTurnIndex).toBe(roomBeforeRestart.state.currentTurnIndex);
    expect(roomAfterRestart.state.turnNumber).toBe(roomBeforeRestart.state.turnNumber);
    expect(roomAfterRestart.state.consecutivePasses).toBe(roomBeforeRestart.state.consecutivePasses);
    expect(roomAfterRestart.state.bag).toEqual(roomBeforeRestart.state.bag);
    expect(roomAfterRestart.state.board).toEqual(roomBeforeRestart.state.board);
    const racksAfter = roomAfterRestart.state.players.map((p) => p.rack).sort();
    const racksBefore = roomBeforeRestart.state.players.map((p) => p.rack).sort();
    expect(racksAfter).toEqual(racksBefore);

    // La partie reste jouable après rechargement : c'est bien au tour de Bob.
    const result = await roomAfterRestart.pass(bobId);
    expect(result.nextTurnIndex).toBe(0);
  });

  describe('turn timeout auto-pass', () => {
    // Utilise un vrai (court) délai plutôt que des fake timers : le callback de timeout
    // déclenche une vraie écriture en base (persistMove), et `vi.advanceTimersByTimeAsync`
    // ne garantit pas d'attendre une E/S réelle jusqu'au bout (source de flakiness observée
    // sous charge, quand les suites de tests tournent en parallèle).
    it('automatically passes the current player when their turn expires', async () => {
      const { gameId, aliceId } = await createTestGame(1);
      createdGameIds.push(gameId);
      const { io } = stubIO();
      const room = await GameRoom.load(io, acceptAllDictionary, gameId);
      await room.start(aliceId);
      expect(room.state.currentTurnIndex).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(room.state.currentTurnIndex).toBe(1);
      expect(room.state.consecutivePasses).toBe(1);

      const moves = await prisma.move.findMany({ where: { gameId, gamePlayerId: aliceId } });
      expect(moves.some((m) => m.triggeredBy === 'timeout')).toBe(true);
    }, 10_000);
  });
});
