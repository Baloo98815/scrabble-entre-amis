import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWord } from '@scrabble/shared';

const DATA_DIR = new URL('./data/', import.meta.url);
export const NORMALIZED_OUTPUT_PATH = fileURLToPath(new URL('dictionary.normalized.txt', DATA_DIR));

/**
 * Extrait la liste de mots d'un export Lexique383 (TSV avec une colonne d'en-tête `ortho`),
 * ou d'un simple fichier texte à un mot par ligne si aucune colonne `ortho` n'est trouvée.
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

function main(): void {
  const sourcePath = process.argv[2] ?? process.env.DICTIONARY_SOURCE_FILE;
  if (!sourcePath) {
    console.error(
      'Usage: pnpm run seed:normalize <chemin-vers-Lexique383.tsv>\n' +
        "(ou DICTIONARY_SOURCE_FILE=<chemin> pnpm run seed:normalize)\n\n" +
        'Téléchargez Lexique383.tsv depuis http://www.lexique.org (base ouverte) et placez-le\n' +
        'localement avant de lancer cette commande.',
    );
    process.exit(1);
  }

  const content = readFileSync(sourcePath, 'utf-8');
  const words = extractWordsFromTsv(content);

  mkdirSync(dirname(NORMALIZED_OUTPUT_PATH), { recursive: true });
  writeFileSync(NORMALIZED_OUTPUT_PATH, words.join('\n') + '\n', 'utf-8');
  console.log(`${words.length} mots normalisés écrits dans ${NORMALIZED_OUTPUT_PATH}`);
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}
