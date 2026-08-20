import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { GUEST_COOKIE_NAME, SESSION_COOKIE_NAME } from '../services/auth.service.js';

function cookieHeader(response: { cookies: Array<{ name: string; value: string }> }, name: string): string {
  const cookie = response.cookies.find((c) => c.name === name);
  if (!cookie) throw new Error(`Cookie ${name} absent de la réponse.`);
  return `${cookie.name}=${cookie.value}`;
}

describe('games routes', () => {
  let app: FastifyInstance;
  const createdGameIds: string[] = [];
  const createdEmails: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await app.close();
  });

  it('creates a game as a guest and previews it publicly', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { maxPlayers: 3, pseudo: 'Hôte' },
    });
    expect(createResponse.statusCode).toBe(201);
    const game = createResponse.json().game;
    createdGameIds.push(game.id);
    expect(game.players).toHaveLength(1);
    expect(game.players[0].pseudo).toBe('Hôte');

    const previewResponse = await app.inject({ method: 'GET', url: `/api/games/${game.inviteCode}` });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().game.players[0].isYou).toBe(false);
  });

  it('requires a pseudo for a guest to create or join a game', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/games', payload: {} });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('PSEUDO_REQUIRED');
  });

  it('lets a second guest join via the invite link without duplicating on a repeat join', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { maxPlayers: 3, pseudo: 'Hôte' },
    });
    const game = createResponse.json().game;
    createdGameIds.push(game.id);

    const joinResponse = await app.inject({
      method: 'POST',
      url: `/api/games/${game.inviteCode}/join`,
      payload: { pseudo: 'Invité' },
    });
    expect(joinResponse.statusCode).toBe(200);
    expect(joinResponse.json().game.players).toHaveLength(2);
    const guestCookie = cookieHeader(joinResponse, GUEST_COOKIE_NAME);

    const secondJoin = await app.inject({
      method: 'POST',
      url: `/api/games/${game.inviteCode}/join`,
      payload: { pseudo: 'Invité' },
      headers: { cookie: guestCookie },
    });
    expect(secondJoin.statusCode).toBe(200);
    expect(secondJoin.json().game.players).toHaveLength(2); // pas de doublon
  });

  it('refuses to join a game that is already full', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { maxPlayers: 2, pseudo: 'Hôte' },
    });
    const game = createResponse.json().game;
    createdGameIds.push(game.id);

    const firstJoin = await app.inject({
      method: 'POST',
      url: `/api/games/${game.inviteCode}/join`,
      payload: { pseudo: 'Joueur2' },
    });
    expect(firstJoin.statusCode).toBe(200);

    const secondJoin = await app.inject({
      method: 'POST',
      url: `/api/games/${game.inviteCode}/join`,
      payload: { pseudo: 'Joueur3' },
    });
    expect(secondJoin.statusCode).toBe(409);
    expect(secondJoin.json().error.code).toBe('GAME_FULL');
  });

  it('returns 404 for an unknown invite code', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/games/ce-code-nexiste-pas' });
    expect(response.statusCode).toBe(404);
  });

  describe('authenticated history', () => {
    const email = `games-test-${randomUUID()}@example.com`;
    let sessionCookie: string;
    let ownedGameId: string;

    beforeAll(async () => {
      createdEmails.push(email);
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, password: 'motdepasse123', pseudo: 'Historique' },
      });
      sessionCookie = cookieHeader(registerResponse, SESSION_COOKIE_NAME);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { maxPlayers: 2 },
        headers: { cookie: sessionCookie },
      });
      ownedGameId = createResponse.json().game.id;
      createdGameIds.push(ownedGameId);
    });

    it('rejects /mine without authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/games/mine' });
      expect(response.statusCode).toBe(401);
    });

    it('lists the authenticated user own games', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/games/mine',
        headers: { cookie: sessionCookie },
      });
      expect(response.statusCode).toBe(200);
      const ids = response.json().games.map((g: { id: string }) => g.id);
      expect(ids).toContain(ownedGameId);
    });

    it('returns the game detail (with move history) for a player of the game', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${ownedGameId}/detail`,
        headers: { cookie: sessionCookie },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().game.moves).toEqual([]);
    });

    it("forbids access to another user's game detail", async () => {
      const otherEmail = `games-test-other-${randomUUID()}@example.com`;
      createdEmails.push(otherEmail);
      const otherRegister = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: otherEmail, password: 'motdepasse123', pseudo: 'Autre' },
      });
      const otherCookie = cookieHeader(otherRegister, SESSION_COOKIE_NAME);

      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${ownedGameId}/detail`,
        headers: { cookie: otherCookie },
      });
      expect(response.statusCode).toBe(403);
    });
  });
});
