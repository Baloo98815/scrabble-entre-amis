import { readFileSync, existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { NORMALIZED_OUTPUT_PATH } from './normalize.js';

const prisma = new PrismaClient();
const BATCH_SIZE = 5000;

async function main(): Promise<void> {
  if (!existsSync(NORMALIZED_OUTPUT_PATH)) {
    console.error(
      `Fichier introuvable: ${NORMALIZED_OUTPUT_PATH}\n` +
        "Lancez d'abord `pnpm run seed:normalize <chemin-vers-Lexique383.tsv>`.",
    );
    process.exit(1);
  }

  const words = readFileSync(NORMALIZED_OUTPUT_PATH, 'utf-8')
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean);

  let inserted = 0;
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE).map((word) => ({ word, source: 'seed' }));
    const result = await prisma.dictionaryWord.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }

  console.log(`${inserted} mots insérés dans dictionary_words (sur ${words.length} lus).`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
