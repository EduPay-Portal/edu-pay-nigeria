#!/usr/bin/env bash
# 07_smoke_test.sh — sanity check the new deployment.
# Usage: ./07_smoke_test.sh https://<NEW_REF>.supabase.co
set -euo pipefail
BASE="${1:?usage: $0 https://<NEW_REF>.supabase.co}"

check() {
  local name="$1" path="$2"
  printf "[smoke] %-32s " "$name"
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path" || echo 000)
  echo "HTTP $code"
}

# Edge function presence (expect 401/400, NOT 404)
check "dva-create"             "/functions/v1/dva-create"
check "wema-webhook"           "/functions/v1/wema-webhook"
check "paystack-webhook"       "/functions/v1/paystack-webhook"
check "reconcile-transactions" "/functions/v1/reconcile-transactions"
check "simulate-payment"       "/functions/v1/simulate-payment"

# REST endpoint sanity
check "rest root"   "/rest/v1/"
check "auth health" "/auth/v1/health"

echo "[smoke] done. 404 on any function = not deployed. 401/400 = deployed."
