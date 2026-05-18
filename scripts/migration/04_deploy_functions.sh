#!/usr/bin/env bash
# 04_deploy_functions.sh — deploy all 9 edge functions to the new project.
# Prereq: `supabase login` and `supabase link --project-ref <NEW_REF>` already run.
set -euo pipefail

FUNCTIONS=(
  dva-create
  dva-reissue
  wema-webhook
  paystack-webhook
  create-virtual-account
  bulk-create-students
  bulk-create-virtual-accounts
  reconcile-transactions
  simulate-payment
)

for fn in "${FUNCTIONS[@]}"; do
  echo "[deploy] $fn"
  supabase functions deploy "$fn" --no-verify-jwt
done

echo "[deploy] done. List:"
supabase functions list
