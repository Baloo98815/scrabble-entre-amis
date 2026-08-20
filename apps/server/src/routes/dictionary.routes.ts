import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../plugins/authContext.js';
import { addWord, isValidWord, removeWord } from '../services/dictionary.service.js';

const wordParamSchema = z.object({ word: z.string().min(1).max(30) });
const addWordSchema = z.object({ word: z.string().min(1).max(30) });

/** Public : sert le champ "tester un mot" pendant une partie, sans consommer de tour. */
export async function dictionaryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/check/:word', async (request) => {
    const { word } = wordParamSchema.parse(request.params);
    return { word, valid: isValidWord(word) };
  });
}

/** Réservé aux administrateurs : ajout/retrait de mots sans redéploiement. */
export async function adminDictionaryRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', async (request) => {
    const { userId } = requireAdmin(request);
    const { word } = addWordSchema.parse(request.body);
    const normalized = await addWord(word, `admin:${userId}`);
    return { word: normalized };
  });

  app.delete('/:word', async (request) => {
    requireAdmin(request);
    const { word } = wordParamSchema.parse(request.params);
    await removeWord(word);
    return { word };
  });
}
