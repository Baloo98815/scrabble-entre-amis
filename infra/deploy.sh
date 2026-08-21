#!/usr/bin/env bash
# Déploiement / mise à jour sur le VPS. Idempotent : peut être relancé après un `git pull`.
#
# Usage (depuis le VPS, à la racine du repo) :
#   cp infra/.env.example infra/.env   # une seule fois, puis remplir les valeurs
#   ./infra/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "infra/.env introuvable. Copie infra/.env.example vers infra/.env et remplis les valeurs." >&2
  exit 1
fi
set -a
source .env
set +a

: "${DOMAIN:?DOMAIN manquant dans infra/.env}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL manquant dans infra/.env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant dans infra/.env}"
: "${JWT_SECRET:?JWT_SECRET manquant dans infra/.env}"

mkdir -p nginx/conf.d

CERT_PRESENT=$(docker compose run --rm --entrypoint sh certbot -c \
  "[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ] && echo yes || echo no" | tr -d '\r\n')

if [ "$CERT_PRESENT" != "yes" ]; then
  echo "==> Aucun certificat trouvé pour ${DOMAIN} : démarrage en mode bootstrap (HTTP uniquement)."
  sed "s/__DOMAIN__/${DOMAIN}/g" nginx/scrabble-bootstrap.conf.template > nginx/conf.d/scrabble.conf
else
  echo "==> Certificat existant détecté pour ${DOMAIN}."
  sed "s/__DOMAIN__/${DOMAIN}/g" nginx/scrabble.conf.template > nginx/conf.d/scrabble.conf
fi

echo "==> Construction des images server/web..."
docker compose build server web

echo "==> Démarrage de Postgres..."
docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-scrabble}" -d "${POSTGRES_DB:-scrabble}" >/dev/null 2>&1; do
  sleep 1
done

echo "==> Démarrage server / web / nginx..."
docker compose up -d server web nginx

if [ "$CERT_PRESENT" != "yes" ]; then
  echo "==> Obtention du certificat Let's Encrypt pour ${DOMAIN}..."
  # --entrypoint certbot : le service "certbot" définit un entrypoint fixe (boucle de
  # renouvellement, voir plus bas) qui ignorerait sinon silencieusement la commande
  # "certonly" passée ici.
  docker compose run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
    -d "${DOMAIN}" --email "${LETSENCRYPT_EMAIL}" --agree-tos --no-eff-email -n

  echo "==> Bascule sur la configuration HTTPS complète..."
  sed "s/__DOMAIN__/${DOMAIN}/g" nginx/scrabble.conf.template > nginx/conf.d/scrabble.conf
  docker compose exec nginx nginx -s reload
fi

echo "==> Démarrage du renouvellement automatique du certificat..."
docker compose up -d certbot

echo "==> Déploiement terminé : https://${DOMAIN}"
