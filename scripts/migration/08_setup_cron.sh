#!/usr/bin/env bash
# 08_setup_cron.sh — recreate the two scheduled jobs on the new project.
#
# These are NOT in supabase/migrations — they live only in the database's
# cron schedule, so they must be recreated by hand after cutover.
#
#   virtual-account-provisioning-retry-worker   every 2 minutes
#   virtual-account-reconciliation-daily        daily at 02:00 UTC
#
# Usage:
#   CRON_SECRET=xxxx ./08_setup_cron.sh "$NEW_DIRECT_URL" <NEW_PROJECT_REF>
set -euo pipefail
NEW_URL="${1:?usage: $0 <NEW_DIRECT_URL> <NEW_PROJECT_REF>}"
REF="${2:?usage: $0 <NEW_DIRECT_URL> <NEW_PROJECT_REF>}"
: "${CRON_SECRET:?set CRON_SECRET in the environment (same value as the edge-function secret)}"

BASE="https://${REF}.supabase.co/functions/v1"

psql "$NEW_URL" -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('virtual-account-provisioning-retry-worker')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='virtual-account-provisioning-retry-worker');
SELECT cron.unschedule('virtual-account-reconciliation-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='virtual-account-reconciliation-daily');

SELECT cron.schedule(
  'virtual-account-provisioning-retry-worker',
  '*/2 * * * *',
  \$\$
  SELECT net.http_post(
    url := '${BASE}/provisioning-retry-worker',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "${CRON_SECRET}"}'::jsonb,
    body := jsonb_build_object('source', 'cron')
  );
  \$\$
);

SELECT cron.schedule(
  'virtual-account-reconciliation-daily',
  '0 2 * * *',
  \$\$
  SELECT net.http_post(
    url := '${BASE}/reconcile-missing-virtual-accounts',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "${CRON_SECRET}"}'::jsonb,
    body := jsonb_build_object('source', 'cron')
  );
  \$\$
);
SQL

echo "[cron] scheduled. Current jobs:"
psql "$NEW_URL" -c "SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;"
