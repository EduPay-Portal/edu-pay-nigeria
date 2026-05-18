#!/usr/bin/env bash
# 03_restore_to_new.sh — restore data into the new Supabase project.
# Prereq: schema already applied via `supabase db push`.
# Usage: ./03_restore_to_new.sh "$NEW_DIRECT_URL" ./migration-dump
set -euo pipefail
NEW_URL="${1:?usage: $0 <NEW_DIRECT_URL> <DUMP_DIR>}"
DUMP="${2:-./migration-dump}"

echo "[restore] auth.users + auth.identities..."
psql "$NEW_URL" -v ON_ERROR_STOP=1 -f "$DUMP/auth_users.sql"

echo "[restore] public data (triggers disabled during load)..."
psql "$NEW_URL" -v ON_ERROR_STOP=1 -f "$DUMP/public_data.sql"

echo "[restore] re-syncing sequences..."
psql "$NEW_URL" <<'SQL'
SELECT setval('public.transaction_ref_seq',
  GREATEST(1, (SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(reference,'\D','','g'),'')::BIGINT),1) FROM public.transactions)));
SELECT setval('public.student_admission_seq',
  GREATEST(1, (SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(admission_number,'\D','','g'),'')::BIGINT),1) FROM public.student_profiles)));
SQL

echo "[restore] done. Spot-check counts:"
psql "$NEW_URL" -c "
SELECT 'profiles' t, COUNT(*) FROM public.profiles UNION ALL
SELECT 'user_roles', COUNT(*) FROM public.user_roles UNION ALL
SELECT 'student_profiles', COUNT(*) FROM public.student_profiles UNION ALL
SELECT 'wallets', COUNT(*) FROM public.wallets UNION ALL
SELECT 'virtual_accounts', COUNT(*) FROM public.virtual_accounts UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users;
"
