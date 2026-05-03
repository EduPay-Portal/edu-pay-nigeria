## Goal

Restore the empty Lovable Cloud database to the full project schema, then finish the remaining Paystack test-mode hardening frontend work.

## Phase 1 — Apply database schema bundle

Run the SQL files in this exact order via the migration tool (one consolidated migration submission per file group, idempotent where possible):

1. `database_setup.sql` — base tables, enums, RLS, triggers (profiles, user_roles, wallets, transactions, student/parent/admin profiles, role-creation triggers, idempotency, balance validation).
2. `migrations/003_paystack_virtual_accounts.sql` — `virtual_accounts` table + RLS.
3. `migrations/004_bulk_import_infrastructure.sql` — `students_import_staging` + bulk-import helpers.
4. `migrations/005_populate_staging_derived_columns.sql` — derived-column triggers for staging.
5. `migrations/006_fix_rls_student_parent_profiles.sql` — RLS hardening for student/parent profiles (uses `public.has_role()`).
6. `migrations/007_reset_bulk_import.sql` and `008_clear_staging_table.sql` — only run if staging tables exist; safe no-ops on a fresh DB.
7. `migrations/009_auto_virtual_account_creation.sql` — DB trigger that calls the `create-virtual-account` Edge Function on student insert.
8. `migrations/010_reconciliation_functions.sql` — reconciliation RPCs used by the Reconciliation page.
9. `migrations/011_payment_hardening.sql` — `payment_method` + `provider` columns and the `trg_apply_transaction_to_wallet` trigger that credits/debits wallets only when `transactions.status` flips to `completed`.

Notes:
- Migration 011 supersedes the older `update_wallet_balance` trigger from `database_setup.sql`. The migration drops the legacy trigger before installing the hardened one to avoid double-crediting.
- All policies use `public.has_role()` SECURITY DEFINER per project rule.
- After apply, verify via `supabase--read_query` that `wallets`, `transactions`, `virtual_accounts`, and `students_import_staging` exist, and that `trg_apply_transaction_to_wallet` is present on `transactions`.
- Run `supabase--linter` and resolve any critical findings (RLS gaps, function search_path).

## Phase 2 — Auth configuration

- Confirm email auto-confirm stays OFF (per project rule).
- Google OAuth: leave disabled for now unless user requests; auth pages already exist.

## Phase 3 — Frontend pieces (Paystack hardening)

1. **Mock Virtual Account generator (test mode)**
   - In `create-virtual-account` Edge Function, when `PAYSTACK_SECRET_KEY` starts with `sk_test_` AND Paystack DVA is unavailable, generate a deterministic mock account: `account_number = "TEST" + last 6 of student id`, bank `Test Bank`, `provider = 'mock'`. Persist into `virtual_accounts`.
   - Surface a "Test Mode" badge in `VirtualAccountCard` and `VirtualAccountStatus`.

2. **Metadata wiring on Paystack Inline (card top-up)**
   - In `usePaystackPayment`, ensure `metadata.student_id` (and `wallet_id`, `category`) is always sent. The shared processor resolves payments via `account_number` → `metadata.student_id` → reject.
   - Generate references with `TEST_` prefix when in test mode so the simulator and live webhook can be distinguished.

3. **/payment-success page**
   - New route `src/pages/PaymentSuccess.tsx`. Reads `?reference=` from URL, polls `transactions` by reference for up to ~20s, shows pending → success → failure states. Routes back to dashboard.
   - Register route in `src/App.tsx`.

4. **Payment Simulator polish** (`PaymentSimulatorPage`)
   - Confirm it calls `simulate-payment` Edge Function (which uses the shared processor). Show resulting transaction + wallet delta. Add visible "TEST MODE ONLY" banner.

5. **Wallet/Transaction UI sanity**
   - Verify `WalletCard`, `TransactionTable`, `TopUpWalletDialog` render without type errors against regenerated `src/integrations/supabase/types.ts`.
   - Ensure no client code writes directly to `wallets.balance` (must flow through `transactions` + trigger).

## Phase 4 — Verification

- Manual flow: create test student → VA auto-created (mock in test mode) → simulate payment → wallet balance updates exactly once → transaction visible in admin + parent views.
- Webhook flow: POST a signed test payload to `paystack-webhook`; confirm HMAC verification, idempotency (replay rejected), and trigger-driven wallet credit.
- Run `supabase--linter` again; address any new findings.

## Technical details

- No edits to `src/integrations/supabase/client.ts` or `types.ts` (auto-generated).
- Migration 011 drop/recreate sequence: `DROP TRIGGER IF EXISTS on_transaction_wallet_update ON public.transactions;` before creating `trg_apply_transaction_to_wallet`.
- Edge Functions affected: `create-virtual-account`, `paystack-webhook`, `simulate-payment`, plus `_shared/process-payment.ts` (already in place).
- No additional secrets needed; `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` are already set.

## Out of scope

- Switching to live Paystack keys.
- Removing Lovable Cloud or porting to an external Supabase project.
- Google OAuth setup.
