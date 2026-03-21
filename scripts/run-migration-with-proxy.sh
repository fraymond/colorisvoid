#!/bin/bash
# Migrate Cloud SQL → Supabase
# Instance: block-space-350920:us-central1:colorisvoid-db
# Run: ./scripts/run-migration-with-proxy.sh

set -e

INSTANCE="block-space-350920:us-central1:colorisvoid-db"
PORT=5433

# Get DATABASE_URL from Secret Manager and convert to localhost
RAW=$(gcloud secrets versions access latest --secret=DATABASE_URL 2>/dev/null || true)
if [ -z "$RAW" ]; then
  echo "Run: gcloud auth application-default login"
  echo "Then set CLOUD_SQL_DATABASE_URL manually (postgresql://USER:PASSWORD@localhost:${PORT}/colorisvoid)"
  exit 1
fi

# Convert Unix socket URL to TCP localhost URL
# From: postgresql://user:pass@localhost/db?host=/cloudsql/...
# To:   postgresql://user:pass@localhost:PORT/db?schema=public
CLOUD_SQL_URL=$(echo "$RAW" | sed -E 's|@localhost/|@localhost:'"${PORT}"'/|' | sed -E 's|\?host=/cloudsql/[^&]*&?||')
export CLOUD_SQL_DATABASE_URL="${CLOUD_SQL_URL}?schema=public"

echo "Starting Cloud SQL Proxy (Ctrl+C to stop after migration)..."
cloud-sql-proxy --port "${PORT}" "${INSTANCE}" &
PROXY_PID=$!
trap "kill $PROXY_PID 2>/dev/null" EXIT

sleep 3
npm run migrate:cloudsql-to-supabase
