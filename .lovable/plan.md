# Moving ASC-Pay onto Your Own Backend

Goal: the payment portal keeps working exactly as it does today, but the database, logins, and the five Wema endpoints run on an account you own and pay for directly, instead of Lovable Cloud.

Nothing is deleted or switched off until the new setup is proven working side by side with the current one.

## Defaults used in this plan

- **Timing:** prepare everything now, cut over after Wema confirms their testing and before real money flows.
- **Data:** everything moves across — students, parents, wallets, `711` accounts, payment history, audit logs. Passwords keep working.
- **Split of work:** I prepare every file, script and check here; you do the parts only you can do (creating the account, pasting keys, DNS).
- **Addresses:** Wema receives one clean set of final URLs at cutover. Optional custom-domain step included so future moves never change those URLs again.

## Stages

### Stage 1 — Prepare (no risk, nothing changes)
- Confirm the repo's migration scripts still match the live database (tables, functions, triggers, edge functions).
- Refresh the step-by-step runbook so every command is copy-paste ready.
- List exactly which secrets you must re-enter on the new backend, and which are created automatically.

### Stage 2 — You create the new backend
- You open the new hosting account and a project in the London region.
- You paste the project keys back here (stored securely, never into the code).

### Stage 3 — Rebuild the structure
- Apply the existing database structure to the new project: all tables, security rules, permissions, triggers, and helper functions.
- Verify no differences against the current database.

### Stage 4 — Copy the data
- Copy users (passwords included), students, parents, wallets, virtual accounts, transactions, logs and staging rows.
- Re-sync the counters used for admission numbers and payment references.
- Row-by-row count comparison — every table must match exactly.

### Stage 5 — Deploy the endpoints
- Deploy all edge functions, including the five Wema endpoints.
- Set the Wema token and fallback identity values on the new backend.
- Re-run the same end-to-end endpoint checks used before: authentication, lookup, notification, duplicate handling, mini statement, KYC, block/unblock.

### Stage 6 — Point the website at the new backend
- Update the site's backend settings on Vercel and redeploy.
- Full sign-in test as admin, parent and student; check wallet, virtual account and transaction screens.

### Stage 7 — Hand new URLs to Wema
- Send Wema the final endpoint addresses and a freshly generated token through a secure channel.
- Optional: put the endpoints behind `api.ahmadiyyasciencecollege.ng` first, so this is the last time those addresses ever change.

### Stage 8 — Watch, then retire
- Run both backends in parallel for 48 hours; the old one stays as instant fallback.
- After a clean week, switch off Lovable Cloud for this project.

## What this costs you

- New backend: roughly $25/month once out of the free tier (free tier is enough for testing).
- Website hosting: unchanged, already yours.
- Lovable: only needed for further building, not for running the app.

## Rollback

At any point before Stage 8, revert the website settings and the Wema URLs to the current backend. It stays untouched and live throughout.

## Technical notes

- Existing assets reused: `MIGRATION.md`, `OWN_YOUR_BACKEND.md`, and `scripts/migration/01`–`07`.
- Schema is re-applied from `supabase/migrations/` via `supabase db push`, not from a hand-written dump; drift checked with `pg_dump --schema-only` diff.
- `auth.users` and `auth.identities` are dumped data-only so bcrypt hashes survive; public tables dumped with `--disable-triggers` to avoid double-crediting wallets on restore.
- Sequences `transaction_ref_seq` and `student_admission_seq` reset with `setval()` after restore.
- Edge functions deployed with `--no-verify-jwt` (Wema uses static Bearer auth in `_shared/payments/wema-vas.ts`).
- Secrets to set manually: `WEMA_VAS_BEARER_TOKEN`, `WEMA_ACCOUNT_PREFIX`, `WEMA_ENV`, `WEMA_VENDOR_NAME`, `WEMA_FALLBACK_BVN`, `WEMA_FALLBACK_NIN`, `CRON_SECRET`. Supabase-prefixed ones are auto-provisioned.
- Cron schedules for the retry worker (2 min) and reconciliation (daily 02:00 UTC) must be recreated on the new project.
- `src/integrations/supabase/types.ts` regenerated against the new project ref; Vercel env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` updated for Production and Preview.
- `src/lib/env.ts` still carries stale hardcoded fallback values from an old project — these get cleaned up during Stage 6.

## Not included

- No change to how payments, fees, wallets or virtual accounts work.
- No change to the `711` prefix or account numbers.
- No student data re-import.
