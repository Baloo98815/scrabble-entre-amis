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

# Base de données locale (Postgres + Adminer sur http://localhost:8080)
docker compose -f infra/docker-compose.dev.yml up -d

# Dans apps/server : copier .env (déjà fourni pour le dev) puis migrer
cd apps/server
npx prisma migrate dev

# Dictionnaire : la source unique est la table Postgres dictionary_words, chargée en mémoire
# au démarrage du serveur (aucune dépendance à la base pour valider un mot en cours de partie).
# Peupler le dictionnaire principal (mots ODS de data/ods-fr.txt) une fois après la migration :
pnpm run seed:dictionary
# La commande est idempotente (relançable sans doublon). Pour importer une autre liste (fichier
# « un mot par ligne » ou TSV Lexique383) : pnpm run seed:dictionary <chemin-vers-fichier>.
# Ajouts/retraits ponctuels « à la volée » : via l'écran d'admin ou les routes /api/admin/dictionary.

# Lancer les deux serveurs (2 terminaux, depuis la racine)
pnpm dev:server   # http://localhost:3000
pnpm dev:web      # http://localhost:5173 (proxy /api et /socket.io vers le serveur)
```

Tests : `pnpm build && pnpm -r run test` depuis la racine (build nécessaire car les apps
consomment `@scrabble/shared` via son dossier `dist/`).

## Déploiement (VPS Ubuntu)

Prérequis sur le VPS : Docker + le plugin Docker Compose installés, le nom de domaine qui
pointe déjà (enregistrement DNS de type A) vers l'IP du VPS, les ports 80 et 443 ouverts.

```bash
# Sur le VPS
git clone https://github.com/Baloo98815/scrabble-entre-amis.git
cd scrabble-entre-amis
cp infra/.env.example infra/.env
nano infra/.env   # DOMAIN, LETSENCRYPT_EMAIL, POSTGRES_PASSWORD, JWT_SECRET

./infra/deploy.sh
```

`deploy.sh` est idempotent : il construit les images, démarre Postgres/serveur/web, obtient
automatiquement le certificat Let's Encrypt au tout premier lancement (bascule d'une config
Nginx temporaire HTTP-only vers la config HTTPS complète une fois le certificat obtenu), et
démarre le renouvellement automatique. Pour mettre à jour après un nouveau commit :

```bash
git pull
./infra/deploy.sh
```

Le mot de passe Postgres et le secret JWT doivent être générés une seule fois et ne jamais
être committés (`infra/.env` est gitignored) — par exemple avec `openssl rand -base64 48`.
