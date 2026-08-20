import { normalizeWord, type DictionaryChecker } from '@scrabble/shared';
import { prisma } from '../db/prisma.js';

let cache: Set<string> | null = null;

/** À appeler une fois au démarrage du serveur. */
export async function loadDictionaryCache(): Promise<void> {
  const rows = await prisma.dictionaryWord.findMany({ select: { word: true } });
  cache = new Set(rows.map((r) => r.word));
}

function ensureLoaded(): Set<string> {
  if (!cache) {
    throw new Error("Le cache du dictionnaire n'a pas été chargé (appeler loadDictionaryCache() au démarrage).");
  }
  return cache;
}

export function isValidWord(word: string): boolean {
  return ensureLoaded().has(normalizeWord(word));
}

/** Implémentation concrète de `DictionaryChecker`, injectée dans le moteur de règles. */
export const dictionaryChecker: DictionaryChecker = { isValidWord };

/** Ajoute un mot en base et met à jour le cache immédiatement, sans reload complet. */
export async function addWord(word: string, source: string): Promise<string> {
  const normalized = normalizeWord(word);
  if (!normalized) throw new Error('Mot invalide.');
  await prisma.dictionaryWord.upsert({
    where: { word: normalized },
    create: { word: normalized, source },
    update: { source },
  });
  ensureLoaded().add(normalized);
  return normalized;
}

/** Retire un mot de la base et du cache. */
export async function removeWord(word: string): Promise<void> {
  const normalized = normalizeWord(word);
  await prisma.dictionaryWord.deleteMany({ where: { word: normalized } });
  ensureLoaded().delete(normalized);
}

export function cacheSize(): number {
  return ensureLoaded().size;
}
