#!/usr/bin/env bash
# 07_smoke_test.sh — sanity check the new deployment.
# Usage: ./07_smoke_test.sh https://<NEW_REF>.supabase.co
set -euo pipefail
BASE="${1:?usage: $0 https://<NEW_REF>.supabase.co}"

check() {
  local name="$1" path="$2"
  printf "[smoke] %-38s " "$name"
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE$path" \
           -H 'Content-Type: application/json' -d '{}' || echo 000)
  echo "HTTP $code"
}

# Wema vendor-hosted endpoints (expect 401 without a bearer token, NOT 404)
check "wema-account-lookup"            "/functions/v1/wema-account-lookup"
check "wema-transaction-notification"  "/functions/v1/wema-transaction-notification"
check "wema-mini-statement"            "/functions/v1/wema-mini-statement"
check "wema-kyc-details"               "/functions/v1/wema-kyc-details"
check "wema-block-account"             "/functions/v1/wema-block-account"

# Internal functions (expect 400/401/403, NOT 404)
check "dva-create"                     "/functions/v1/dva-create"
check "provision-student-va"           "/functions/v1/provision-student-virtual-account"
check "provisioning-retry-worker"      "/functions/v1/provisioning-retry-worker"
check "reconcile-missing-va"           "/functions/v1/reconcile-missing-virtual-accounts"
check "reconcile-transactions"         "/functions/v1/reconcile-transactions"
check "simulate-payment"               "/functions/v1/simulate-payment"
check "admin-create-user"              "/functions/v1/admin-create-user"
check "bulk-create-students"           "/functions/v1/bulk-create-students"

echo
printf "[smoke] %-38s " "rest root"
curl -s -o /dev/null -w 'HTTP %{http_code}\n' "$BASE/rest/v1/"
printf "[smoke] %-38s " "auth health"
curl -s -o /dev/null -w 'HTTP %{http_code}\n' "$BASE/auth/v1/health"

echo "[smoke] done. 404 on any function = not deployed. 400/401/403 = deployed."
