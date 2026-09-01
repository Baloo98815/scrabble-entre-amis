import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../src/db/prisma.js';
import { extractWordsFromTsv } from './normalize.js';

// Source du seed initial du dictionnaire principal (mots ODS, un par ligne). Ce fichier n'est
// lu QUE par ce script — au runtime, la source unique est la table `dictionary_words`.
const DEFAULT_SOURCE_PATH = fileURLToPath(new URL('../../data/ods-fr.txt', import.meta.url));

// Postgres limite le nombre de paramètres d'une requête ; on insère par lots pour rester
// largement sous cette limite malgré les ~400k mots.
const BATCH_SIZE = 5000;

/**
 * Peuple la table `dictionary_words` à partir d'un fichier source (ODS par défaut, ou chemin
 * passé en argument : fichier « un mot par ligne » ou TSV Lexique383 avec colonne `ortho`).
 * Idempotent : `skipDuplicates` ignore les mots déjà présents, donc relançable sans risque.
 * Les mots sont insérés avec `source = 'ods'` ; les ajouts admin (`source = 'admin:<userId>'`)
 * ne sont jamais touchés par ce script.
 */
async function main(): Promise<void> {
  const sourcePath = process.argv[2] ?? DEFAULT_SOURCE_PATH;
  const content = readFileSync(sourcePath, 'utf-8');
  const words = extractWordsFromTsv(content);

  let inserted = 0;
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const data = words.slice(i, i + BATCH_SIZE).map((word) => ({ word, source: 'ods' }));
    const res = await prisma.dictionaryWord.createMany({ data, skipDuplicates: true });
    inserted += res.count;
  }

  console.log(
    `${inserted} nouveaux mots insérés (source=ods) sur ${words.length} du fichier ${sourcePath}.`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
