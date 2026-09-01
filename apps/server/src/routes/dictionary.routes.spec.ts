import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { SESSION_COOKIE_NAME } from '../services/auth.service.js';
import { loadDictionaryCache } from '../services/dictionary.service.js';

function cookieHeader(response: { cookies: Array<{ name: string; value: string }> }, name: string): string {
  const cookie = response.cookies.find((c) => c.name === name);
  if (!cookie) throw new Error(`Cookie ${name} absent de la réponse.`);
  return `${cookie.name}=${cookie.value}`;
}

describe('dictionary routes', () => {
  let app: FastifyInstance;
  const adminEmail = `admin-${randomUUID()}@example.com`;
  const playerEmail = `player-${randomUUID()}@example.com`;
  const password = 'motdepasse123';
  // Mot inventé, absent de la table dictionary_words — sert à vérifier l'aller-retour
  // ajout/retrait sans dépendre du contenu exact du dictionnaire officiel. Lettres
  // uniquement : normalizeWord() supprimerait tout chiffre (ex: un suffixe hexadécimal).
  const testWord = 'ZZTESTWORDINVENTE';

  beforeAll(async () => {
    await loadDictionaryCache();
    app = await buildApp();
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: adminEmail, password, pseudo: 'Admin' } });
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: playerEmail, password, pseudo: 'Joueur' } });
    await prisma.user.update({ where: { email: adminEmail }, data: { isAdmin: true } });
  });

  afterAll(async () => {
    await prisma.dictionaryWord.deleteMany({ where: { word: testWord } });
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, playerEmail] } } });
    await app.close();
  });

  async function loginAs(email: string): Promise<string> {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
    return cookieHeader(res, SESSION_COOKIE_NAME);
  }

  it('GET /check/:word is public and reflects dictionary state', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/dictionary/check/${testWord}` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ word: testWord, valid: false });
  });

  it('rejects an unauthenticated add', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/admin/dictionary', payload: { word: testWord } });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a non-admin add', async () => {
    const cookie = await loginAs(playerEmail);
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/dictionary',
      headers: { cookie },
      payload: { word: testWord },
    });
    expect(response.statusCode).toBe(403);
  });

  it('lets an admin add then remove a word, taking effect immediately', async () => {
    const cookie = await loginAs(adminEmail);

    const addResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/dictionary',
      headers: { cookie },
      payload: { word: testWord.toLowerCase() },
    });
    expect(addResponse.statusCode).toBe(200);
    expect(addResponse.json()).toEqual({ word: testWord });

    const afterAdd = await app.inject({ method: 'GET', url: `/api/dictionary/check/${testWord}` });
    expect(afterAdd.json()).toEqual({ word: testWord, valid: true });

    const removeResponse = await app.inject({
      method: 'DELETE',
      url: `/api/admin/dictionary/${testWord}`,
      headers: { cookie },
    });
    expect(removeResponse.statusCode).toBe(200);

    const afterRemove = await app.inject({ method: 'GET', url: `/api/dictionary/check/${testWord}` });
    expect(afterRemove.json()).toEqual({ word: testWord, valid: false });
  });
});
