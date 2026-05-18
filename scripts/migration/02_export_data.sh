#!/usr/bin/env bash
# 02_export_data.sh — dump data from Lovable Cloud.
# Exports auth.users (bcrypt hashes preserved) + all public.* tables.
# Usage: ./02_export_data.sh "$OLD_DIRECT_URL" ./migration-dump
set -euo pipefail
OLD_URL="${1:?usage: $0 <OLD_DIRECT_URL> <OUT_DIR>}"
OUT="${2:-./migration-dump}"
mkdir -p "$OUT"

TABLES=(
  profiles user_roles
  student_profiles parent_profiles admin_profiles
  wallets virtual_accounts
  transactions webhook_events paystack_webhook_events
  reconciliation_logs settlements
  audit_logs students_import_staging
)

echo "[data] dumping auth.users (passwords, identities, sessions)..."
pg_dump "$OLD_URL" \
  --data-only --no-owner --no-acl \
  --table=auth.users \
  --table=auth.identities \
  -f "$OUT/auth_users.sql"

echo "[data] dumping public tables..."
TABLE_ARGS=()
for t in "${TABLES[@]}"; do TABLE_ARGS+=(--table="public.$t"); done

pg_dump "$OLD_URL" \
  --data-only --no-owner --no-acl \
  --disable-triggers \
  "${TABLE_ARGS[@]}" \
  -f "$OUT/public_data.sql"

echo "[data] done."
wc -l "$OUT"/*.sql
