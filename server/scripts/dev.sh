#!/usr/bin/env bash
# Starts PocketBase for local development with the repository's migrations and hooks.
# Listens on 127.0.0.1:8090 unless PB_HTTP says otherwise (e.g. PB_HTTP=0.0.0.0:8090 for phones).
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/download.sh

exec bin/pocketbase serve \
  --dev \
  --http "${PB_HTTP:-127.0.0.1:8090}" \
  --dir pb_data \
  --migrationsDir pb_migrations \
  --hooksDir pb_hooks \
  "$@"
