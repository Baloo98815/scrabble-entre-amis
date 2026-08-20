import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { SESSION_COOKIE_NAME } from '../services/auth.service.js';

function cookieHeader(response: { cookies: Array<{ name: string; value: string }> }, name: string): string {
  const cookie = response.cookies.find((c) => c.name === name);
  if (!cookie) throw new Error(`Cookie ${name} absent de la réponse.`);
  return `${cookie.name}=${cookie.value}`;
}

describe('auth routes', () => {
  let app: FastifyInstance;
  const email = `test-${randomUUID()}@example.com`;
  const password = 'motdepasse123';

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers a new account and sets a session cookie', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password, pseudo: 'Testeur' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.user.email).toBe(email);
    expect(body.user.pseudo).toBe('Testeur');
    expect(cookieHeader(response, SESSION_COOKIE_NAME)).toBeDefined();
  });

  it('rejects a second registration with the same email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password, pseudo: 'Autre' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects login with a wrong password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'mauvais-mot-de-passe' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('logs in with the right credentials and can then call /me', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    expect(loginResponse.statusCode).toBe(200);
    const cookie = cookieHeader(loginResponse, SESSION_COOKIE_NAME);

    const meResponse = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().user.email).toBe(email);
  });

  it('rejects /me without a session cookie', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });
});
