import { PrismaClient } from '@prisma/client';

/** Instance unique partagée par toute l'application (services, routes, game-runtime). */
export const prisma = new PrismaClient();
