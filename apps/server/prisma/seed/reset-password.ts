import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../src/db/prisma.js';

// Doit rester aligné avec BCRYPT_ROUNDS de services/auth.service.ts et les bornes de
// registerSchema (packages/shared/src/dto/auth.ts : 8 à 72 caractères).
const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

/**
 * Réinitialise le mot de passe d'un utilisateur (dépannage « mot de passe oublié »).
 * Usage : reset-password.ts <email> [nouveau_mot_de_passe]
 * Sans mot de passe fourni, un mot de passe temporaire aléatoire est généré et affiché.
 * Les sessions JWT déjà émises restent valides jusqu'à leur expiration.
 */
async function main(): Promise<void> {
  const [emailArg, passwordArg] = process.argv.slice(2);
  if (!emailArg) {
    console.error('Usage : reset-password <email> [nouveau_mot_de_passe]');
    process.exit(1);
  }
  const email = emailArg.trim().toLowerCase();
  const generated = passwordArg === undefined;
  const password = passwordArg ?? randomBytes(9).toString('base64url');

  if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
    console.error(`Le mot de passe doit faire entre ${MIN_LENGTH} et ${MAX_LENGTH} caractères.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Aucun utilisateur avec l'email ${email}.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  console.log(`Mot de passe réinitialisé pour ${user.pseudo} <${email}>.`);
  if (generated) console.log(`Mot de passe temporaire : ${password}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
