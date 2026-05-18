#!/usr/bin/env bash
# 01_export_schema.sh — dump schema-only SQL from Lovable Cloud Postgres.
# Usage: ./01_export_schema.sh "$OLD_DIRECT_URL" ./migration-dump
set -euo pipefail
OLD_URL="${1:?usage: $0 <OLD_DIRECT_URL> <OUT_DIR>}"
OUT="${2:-./migration-dump}"
mkdir -p "$OUT"

echo "[schema] dumping public schema..."
pg_dump "$OLD_URL" \
  --schema-only --schema=public \
  --no-owner --no-acl --no-comments \
  -f "$OUT/public_schema.sql"

echo "[schema] dumping auth schema (reference only, do NOT restore)..."
pg_dump "$OLD_URL" \
  --schema-only --schema=auth \
  --no-owner --no-acl --no-comments \
  -f "$OUT/auth_schema_REFERENCE.sql" || true

echo "[schema] done. Files in $OUT/"
ls -la "$OUT"
