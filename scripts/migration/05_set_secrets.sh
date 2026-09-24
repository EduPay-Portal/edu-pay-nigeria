#!/usr/bin/env bash
# 05_set_secrets.sh — push runtime secrets into the new Supabase project.
#
# Verified against the live project on 2026-09-24.
# These 7 secrets must be set MANUALLY. Everything prefixed SUPABASE_ is
# auto-provisioned by the new project — do NOT copy those across.
#
# Put real values in a local .env.secrets file (git-ignored). Never commit them.
#
#   WEMA_VAS_BEARER_TOKEN   shared secret Wema uses to call our endpoints
#   WEMA_ACCOUNT_PREFIX     "711" for test; Wema issues the production prefix
#   WEMA_ENV                "test" or "production"
#   WEMA_VENDOR_NAME        vendor name shown in lookup responses
#   WEMA_FALLBACK_BVN       sandbox-only placeholder identity
#   WEMA_FALLBACK_NIN       sandbox-only placeholder identity
#   CRON_SECRET             header the scheduled jobs send to the workers
set -euo pipefail

if [[ -f .env.secrets ]]; then
  # shellcheck disable=SC1091
  source .env.secrets
fi

require() { [[ -n "${!1:-}" ]] || { echo "MISSING $1 — add it to .env.secrets"; exit 1; }; }

for v in WEMA_VAS_BEARER_TOKEN WEMA_ACCOUNT_PREFIX WEMA_ENV WEMA_VENDOR_NAME \
         WEMA_FALLBACK_BVN WEMA_FALLBACK_NIN CRON_SECRET; do
  require "$v"
done

supabase secrets set \
  WEMA_VAS_BEARER_TOKEN="$WEMA_VAS_BEARER_TOKEN" \
  WEMA_ACCOUNT_PREFIX="$WEMA_ACCOUNT_PREFIX" \
  WEMA_ENV="$WEMA_ENV" \
  WEMA_VENDOR_NAME="$WEMA_VENDOR_NAME" \
  WEMA_FALLBACK_BVN="$WEMA_FALLBACK_BVN" \
  WEMA_FALLBACK_NIN="$WEMA_FALLBACK_NIN" \
  CRON_SECRET="$CRON_SECRET"

echo "[secrets] set. Verify (names only, no values):"
supabase secrets list
