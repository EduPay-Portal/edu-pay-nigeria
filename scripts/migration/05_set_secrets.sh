#!/usr/bin/env bash
# 05_set_secrets.sh — push runtime secrets into the new Supabase project.
# Fill in REAL values below from your password manager BEFORE running.
# Do NOT commit this file with values populated. Use a local .env.secrets ignored by git.
set -euo pipefail

if [[ -f .env.secrets ]]; then
  # shellcheck disable=SC1091
  source .env.secrets
fi

require() { [[ -n "${!1:-}" ]] || { echo "MISSING $1"; exit 1; }; }

require PAYSTACK_SECRET_KEY
require PAYSTACK_PUBLIC_KEY
# Wema secrets — required once Wema goes live
require WEMA_API_KEY
require WEMA_WEBHOOK_SECRET
require WEMA_ALLOWED_IPS
require WEMA_BASE_URL

supabase secrets set \
  PAYSTACK_SECRET_KEY="$PAYSTACK_SECRET_KEY" \
  PAYSTACK_PUBLIC_KEY="$PAYSTACK_PUBLIC_KEY" \
  WEMA_API_KEY="$WEMA_API_KEY" \
  WEMA_WEBHOOK_SECRET="$WEMA_WEBHOOK_SECRET" \
  WEMA_ALLOWED_IPS="$WEMA_ALLOWED_IPS" \
  WEMA_BASE_URL="$WEMA_BASE_URL"

echo "[secrets] set. Verify:"
supabase secrets list
