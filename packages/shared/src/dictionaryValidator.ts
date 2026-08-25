import { normalizeWord } from './normalizeWord.js';

/**
 * Interface implémentée côté serveur (dictionary.json + custom-words.json, chargés en cache
 * mémoire au démarrage). Le moteur de règles ne connaît que cette interface — aucune
 * dépendance à une base de données ou à un fichier particulier.
 */
export interface DictionaryChecker {
  isValidWord(word: string): boolean;
}

/** Utile pour les tests du moteur qui ne portent pas sur la validité des mots. */
export const acceptAllDictionary: DictionaryChecker = {
  isValidWord: () => true,
};

/** Dictionnaire simple en mémoire, pratique pour les tests unitaires. */
export function createSetDictionary(words: Iterable<string>): DictionaryChecker {
  const set = new Set(Array.from(words, (word) => normalizeWord(word)));
  return {
    isValidWord: (word: string) => set.has(normalizeWord(word)),
  };
}
