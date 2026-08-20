# Scrabble en ligne

Scrabble multijoueur en ligne (2 à 4 joueurs), pour jouer entre amis en temps réel : comptes ou
mode invité, plusieurs parties simultanées via lien d'invitation, respect des règles officielles
(plateau 15×15, répartition/valeurs des 102 jetons, calcul de score, bonus bingo, fin de partie).

## Structure du monorepo

- `packages/shared` — moteur de règles pur (aucune dépendance réseau) + types/DTO partagés entre
  le client et le serveur.
- `apps/server` — API REST (Fastify) + temps réel (Socket.IO) + persistance (PostgreSQL/Prisma).
- `apps/web` — client React/Vite.
- `infra` — Docker Compose, configuration Nginx + Certbot pour le déploiement sur le VPS.

Voir le plan complet du projet pour le détail de l'architecture, la roadmap par jalons et la
stratégie de tests.

## Démarrage (développement)

```bash
corepack enable
pnpm install
pnpm --filter @scrabble/shared test
```

D'autres instructions (base de données, serveur, client) seront ajoutées au fil des jalons.
