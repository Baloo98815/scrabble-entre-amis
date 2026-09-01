import { normalizeWord } from '@scrabble/shared';

/**
 * Helpers purs d'extraction de mots depuis un fichier source, réutilisés par le script de
 * seed `import-words.ts`. Aucune I/O ici : facile à tester unitairement (cf. normalize.spec.ts).
 */

/**
 * Extrait la liste de mots d'un export Lexique383 (TSV avec une colonne d'en-tête `ortho`),
 * ou d'un simple fichier texte à un mot par ligne si aucune colonne `ortho` n'est trouvée
 * (cas du fichier ODS `data/ods-fr.txt`).
 */
export function extractWordsFromTsv(content: string, column = 'ortho'): string[] {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const header = lines[0]!.split('\t');
  const columnIndex = header.indexOf(column);

  const rawWords: string[] =
    columnIndex === -1
      ? lines
      : lines.slice(1).map((line) => line.split('\t')[columnIndex] ?? '');

  return normalizeAndFilter(rawWords);
}

/** Normalise, filtre (1 à 15 lettres A-Z) et dédoublonne une liste brute de mots. */
export function normalizeAndFilter(rawWords: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of rawWords) {
    const word = normalizeWord(raw);
    if (word.length >= 1 && word.length <= 15) {
      seen.add(word);
    }
  }
  return [...seen].sort();
}
