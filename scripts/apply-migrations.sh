#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Aborting."
  exit 1
fi

MIGRATION_FILE="server/migrations/20260111_create_pending_subscription_changes.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "Applying migration $MIGRATION_FILE to $DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE" || (
  echo "psql failed; showing last 100 lines of migration file for debug:" && tail -n 100 "$MIGRATION_FILE" && false
)

echo "Migration applied successfully."