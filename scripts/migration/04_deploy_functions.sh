#!/usr/bin/env bash
# 04_deploy_functions.sh — deploy all edge functions to the new project.
# Prereq: `supabase login` and `supabase link --project-ref <NEW_REF>` already run.
# Verified against the live project on 2026-09-24: 18 deployable functions
# (_shared is a library folder, not a function).
set -euo pipefail

FUNCTIONS=(
  # Wema vendor-hosted VAS endpoints (Wema calls these)
  wema-account-lookup
  wema-transaction-notification
  wema-mini-statement
  wema-kyc-details
  wema-block-account
  wema-webhook

  # Virtual account provisioning
  dva-create
  dva-reissue
  dva-retire-legacy
  create-virtual-account
  provision-student-virtual-account
  provisioning-retry-worker
  reconcile-missing-virtual-accounts
  bulk-create-virtual-accounts

  # Admin / import / ops
  admin-create-user
  bulk-create-students
  reconcile-transactions
  simulate-payment
)

for fn in "${FUNCTIONS[@]}"; do
  echo "[deploy] $fn"
  supabase functions deploy "$fn" --no-verify-jwt
done

echo "[deploy] done. Expect ${#FUNCTIONS[@]} functions:"
supabase functions list
