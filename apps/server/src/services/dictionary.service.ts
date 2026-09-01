import { normalizeWord, type DictionaryChecker } from '@scrabble/shared';
import { HttpError } from '../errors.js';
import { prisma } from '../db/prisma.js';

let cache: Set<string> | null = null;

/**
 * À appeler une fois au démarrage du serveur. Le dictionnaire a désormais **une seule source
 * à l'exécution** : la table Postgres `dictionary_words`. On y charge tout en mémoire (un
 * `Set` de mots normalisés) pour que la validation en cours de partie ne touche jamais la
 * base, seulement ce cache.
 *
 * La table contient à la fois le dictionnaire principal (mots ODS, `source = 'ods'`, chargés
 * une fois via `pnpm --filter @scrabble/server run seed:dictionary`) et les ajouts « à la
 * volée » de l'admin (`source = 'admin:<userId>'`, via `addWord`/`removeWord`). Le fichier
 * `data/ods-fr.txt` n'est que la source du seed initial — il n'est plus lu au runtime.
 */
export async function loadDictionaryCache(): Promise<void> {
  const rows = await prisma.dictionaryWord.findMany({ select: { word: true } });
  cache = new Set(rows.map((r) => normalizeWord(r.word)));
  if (cache.size === 0) {
    // Pas de mot en base : le jeu refuserait tous les coups. On prévient explicitement plutôt
    // que de laisser un dictionnaire vide passer inaperçu.
    console.warn(
      "Dictionnaire vide : aucun mot dans la table dictionary_words. " +
        'Lancez `pnpm --filter @scrabble/server run seed:dictionary` pour le peupler.',
    );
  }
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

/** Ajoute un mot en base (la source unique) et met à jour le cache — effet immédiat. */
export async function addWord(word: string, source: string): Promise<string> {
  const normalized = normalizeWord(word);
  if (!normalized) throw new HttpError(400, 'INVALID_WORD', 'Mot invalide.');
  await prisma.dictionaryWord.upsert({
    where: { word: normalized },
    create: { word: normalized, source },
    update: { source },
  });
  ensureLoaded().add(normalized);
  return normalized;
}

/**
 * Retire un mot de la base et du cache — effet immédiat. La base étant désormais la source
 * unique, un mot retiré le reste après redémarrage (contrairement à l'ancien modèle à
 * fichiers, où seuls les ajouts « à chaud » étaient retirables). N'a aucun effet si le mot
 * n'existe pas.
 */
export async function removeWord(word: string): Promise<void> {
  const normalized = normalizeWord(word);
  const { count } = await prisma.dictionaryWord.deleteMany({ where: { word: normalized } });
  if (count === 0) return;
  ensureLoaded().delete(normalized);
}

export function cacheSize(): number {
  return ensureLoaded().size;
}
