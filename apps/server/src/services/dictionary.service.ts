import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeWord, type DictionaryChecker } from '@scrabble/shared';

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
 * À appeler une fois au démarrage du serveur. Charge le dictionnaire officiel
 * (`dictionary.json`, ~119k mots) et les mots ajoutés manuellement (`custom-words.json`),
 * fusionnés en mémoire — plus aucune dépendance à la base pour valider un mot.
 */
export async function loadDictionaryCache(): Promise<void> {
  const [official, custom] = await Promise.all([
    readWordList(DICTIONARY_PATH),
    readWordList(CUSTOM_WORDS_PATH),
  ]);
  cache = new Set([...official, ...custom].map(normalizeWord));
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

/** Ajoute un mot à `custom-words.json` et met à jour le cache immédiatement. */
export async function addWord(word: string, source: string): Promise<string> {
  void source; // conservé dans la signature pour compat avec la route admin existante ; plus de traçabilité DB à écrire.
  const normalized = normalizeWord(word);
  if (!normalized) throw new Error('Mot invalide.');
  const custom = await readWordList(CUSTOM_WORDS_PATH);
  if (!custom.includes(normalized)) {
    custom.push(normalized);
    custom.sort();
    await writeFile(CUSTOM_WORDS_PATH, JSON.stringify(custom, null, 2) + '\n', 'utf-8');
  }
  ensureLoaded().add(normalized);
  return normalized;
}

/**
 * Retire un mot de `custom-words.json` et du cache. Un mot du dictionnaire officiel
 * (`dictionary.json`) ne peut pas être retiré par cette route — il resterait de toute façon
 * valide au prochain redémarrage, mieux vaut ne rien changer plutôt que de créer un état
 * incohérent qui ne survit pas à un restart.
 */
export async function removeWord(word: string): Promise<void> {
  const normalized = normalizeWord(word);
  const custom = await readWordList(CUSTOM_WORDS_PATH);
  const next = custom.filter((w) => w !== normalized);
  if (next.length === custom.length) return; // pas un mot custom : rien à faire.
  await writeFile(CUSTOM_WORDS_PATH, JSON.stringify(next, null, 2) + '\n', 'utf-8');
  ensureLoaded().delete(normalized);
}

export function cacheSize(): number {
  return ensureLoaded().size;
}
