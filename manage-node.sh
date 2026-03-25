#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${DATABASE_URL:-}" ]]; then
  cd "${ROOT_DIR}/backend"
  exec npm run manage-node
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  cd "${ROOT_DIR}"
  exec docker compose run --rm --build backend npm run manage-node
fi

echo "DATABASE_URL is not set."
echo "Run with DATABASE_URL exported, or use Docker Compose from this repo."
exit 1
