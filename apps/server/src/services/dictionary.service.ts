import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeWord, type DictionaryChecker } from '@scrabble/shared';
import { HttpError } from '../errors.js';
import { prisma } from '../db/prisma.js';

// `../../data/` : que ce fichier tourne compilé (dist/services/) ou en dev via tsx
// (src/services/), ce chemin relatif pointe toujours vers apps/server/data/ — un dossier
// frère de src/ et dist/, copié tel quel dans l'image Docker (cf. apps/server/Dockerfile).
const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));
const DICTIONARY_PATH = `${DATA_DIR}dictionary.json`;
const CUSTOM_WORDS_PATH = `${DATA_DIR}custom-words.json`;

let cache: Set<string> | null = null;

async function readWordList(path: string): Promise<string[]> {
  const content = await readFile(path, 'utf-8');
  const words: unknown = JSON.parse(content);
  if (!Array.isArray(words)) throw new Error(`${path} doit contenir un tableau JSON de mots.`);
  return words as string[];
}

/**
 * À appeler une fois au démarrage du serveur. Fusionne en mémoire trois sources :
 * - `dictionary.json` : le dictionnaire officiel (~119k mots), statique, mis à jour
 *   uniquement via `pnpm run seed:normalize` + redéploiement.
 * - `custom-words.json` : ajouts en masse, statiques eux aussi (édition manuelle du fichier
 *   + redéploiement) — pratique pour coller une liste de mots d'un coup.
 * - la table `dictionary_words` (Postgres) : ajouts/retraits ponctuels via la route admin
 *   (`addWord`/`removeWord`) ou l'écran d'administration — la seule des trois sources
 *   modifiable à chaud, sans redéploiement. Elle utilise la base uniquement comme espace de
 *   stockage durable (le volume Docker de Postgres survit aux redéploiements, contrairement
 *   au système de fichiers du conteneur `server`, reconstruit à chaque build) ; la
 *   validation d'un mot en cours de partie ne touche elle jamais la base, seulement ce cache
 *   en mémoire.
 */
export async function loadDictionaryCache(): Promise<void> {
  const [official, custom, adminRows] = await Promise.all([
    readWordList(DICTIONARY_PATH),
    readWordList(CUSTOM_WORDS_PATH),
    prisma.dictionaryWord.findMany({ select: { word: true } }),
  ]);
  cache = new Set([...official, ...custom, ...adminRows.map((r) => r.word)].map(normalizeWord));
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

/** Ajoute un mot en base (source durable pour les ajouts à chaud) et met à jour le cache. */
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
 * Retire un mot ajouté en base et du cache. Un mot venant de `dictionary.json` ou
 * `custom-words.json` ne peut pas être retiré par cette route — il resterait de toute façon
 * valide au prochain redémarrage, mieux vaut ne rien changer plutôt que de créer un état
 * incohérent qui ne survit pas à un restart.
 */
export async function removeWord(word: string): Promise<void> {
  const normalized = normalizeWord(word);
  const { count } = await prisma.dictionaryWord.deleteMany({ where: { word: normalized } });
  if (count === 0) return; // pas un mot ajouté à chaud : rien à faire.
  ensureLoaded().delete(normalized);
}

export function cacheSize(): number {
  return ensureLoaded().size;
}
