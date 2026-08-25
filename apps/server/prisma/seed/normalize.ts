import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWord } from '@scrabble/shared';

// `apps/server/data/dictionary.json` : le fichier lu au runtime par dictionary.service.ts
// (cf. sa propre résolution de chemin, identique en dev et compilé).
export const DICTIONARY_OUTPUT_PATH = fileURLToPath(new URL('../../data/dictionary.json', import.meta.url));

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

/**
 * Régénère apps/server/data/dictionary.json à partir d'une source brute (TSV Lexique383
 * ou fichier texte à un mot par ligne). Écrase le fichier existant — pensez à fusionner
 * avec l'ancien contenu en amont si vous ne voulez pas perdre des mots qui n'existent que
 * dans l'ancienne liste.
 */
function main(): void {
  const sourcePath = process.argv[2] ?? process.env.DICTIONARY_SOURCE_FILE;
  if (!sourcePath) {
    console.error(
      'Usage: pnpm run seed:normalize <chemin-vers-Lexique383.tsv>\n' +
        "(ou DICTIONARY_SOURCE_FILE=<chemin> pnpm run seed:normalize)\n\n" +
        'Téléchargez Lexique383.tsv depuis http://www.lexique.org (base ouverte) et placez-le\n' +
        'localement avant de lancer cette commande. Pour ajouter quelques mots ponctuels sans\n' +
        're-générer tout le dictionnaire, éditez plutôt apps/server/data/custom-words.json.',
    );
    process.exit(1);
  }

  const content = readFileSync(sourcePath, 'utf-8');
  const words = extractWordsFromTsv(content);

  mkdirSync(dirname(DICTIONARY_OUTPUT_PATH), { recursive: true });
  writeFileSync(DICTIONARY_OUTPUT_PATH, JSON.stringify(words, null, 2) + '\n', 'utf-8');
  console.log(`${words.length} mots normalisés écrits dans ${DICTIONARY_OUTPUT_PATH}`);
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}
