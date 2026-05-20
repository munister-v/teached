#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f .env ]]; then
  echo "Missing .env. Create it from .env.example before deploying."
  exit 1
fi

git pull --ff-only

docker compose build
docker compose up -d
docker compose ps

echo "TeachEd is running behind http://127.0.0.1:8080"
echo "If this is the first deploy, configure host Nginx with deploy/nginx/host.conf.example and run certbot."
