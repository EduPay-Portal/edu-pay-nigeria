
# Paystack Removal — UI, Dead Code & Card Top-ups

Per your earlier answers: remove Paystack from UI/docs/dead code, and remove card top-ups entirely (DVA-only) until ALATPay is wired up later. Database columns and the `paystack_webhook_events` table stay intact for historical/audit data — renaming them risks corrupting existing records.

## Safety guarantees

- No DB schema changes. No column renames. No data migrations.
- `wema-webhook`, `dva-create`, `dva-reissue`, `simulate-payment`, and the DVA auto-creation trigger are unchanged in behavior.
- Reconciliation page keeps working — the SQL helper functions and their column names are untouched.
- Only Paystack-specific dead branches and user-visible labels change.

## 1. UI text — remove user-visible "Paystack" wording

| File | Change |
|---|---|
| `src/pages/dashboard/admin/WebhooksPage.tsx` | "Monitor and manage Paystack webhook notifications" → "Monitor and manage payment webhook notifications"; same in log subtitle |
| `src/pages/dashboard/admin/ReconciliationPage.tsx` | "received from Paystack" → "received from the payment provider" |
| `src/pages/dashboard/admin/PaymentSimulatorPage.tsx` | "never touch real money or the live Paystack account" → "never touch real money or live accounts" |
| `src/pages/dashboard/admin/TransactionsPage.tsx` | "Paystack Ref" column label → "Provider Ref" |
| `src/pages/PaymentSuccess.tsx` | Read `provider_reference` (already populated by migration) instead of `paystack_reference`; rename label to "Payment Reference" |
| `src/pages/Index.tsx` | Remove Paystack mention from landing copy |
| `src/lib/receipt.ts` | "Paystack Ref" → "Provider Ref" |

## 2. Remove card top-up flow (Paystack Inline)

Delete:
- `src/hooks/usePaystackPayment.ts`
- `src/components/dialogs/TopUpWalletDialog.tsx`
- `<script src="https://js.paystack.co/v1/inline.js">` from `index.html`
- `VITE_PAYSTACK_PUBLIC_KEY` from `.env.example` and from the Zod schema in `src/lib/env.ts`

Update:
- `src/components/dashboard/WalletCard.tsx` — replace the "Top Up" button with a small "Fund via Virtual Account" note that scrolls to / links to the Virtual Account card. Users keep funding via DVA bank transfer (already the primary flow).
- Any other importer of `TopUpWalletDialog` gets its trigger removed.

## 3. Remove dead Paystack code / artifacts

- Delete `supabase/functions/paystack-webhook/` and call `supabase--delete_edge_functions` for `paystack-webhook`.
- Delete `PAYSTACK_SETUP.md`.
- After confirming nothing else reads them, delete the `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` runtime secrets via `secrets--delete_secret`.
- `supabase/functions/_shared/payments/registry.ts` — drop the dead `paystack: undefined` slot and its deprecation comment; registry becomes Wema-only.
- `supabase/functions/_shared/payments/types.ts` — narrow `ProviderName` to `"wema"` (keep "mock" if referenced).
- `supabase/functions/dva-create/index.ts` — stop writing `paystack_customer_code` (column kept for legacy rows; new rows already use `provider_customer_id`).
- `src/hooks/useVirtualAccount.ts` — drop the `paystack_customer_code` field from the TS interface (column still exists in DB; we just stop reading it).
- `scripts/migration/04_deploy_functions.sh` — remove `paystack-webhook` from the deploy list.
- `scripts/migration/02_export_data.sh`, `05_set_secrets.sh`, `07_smoke_test.sh` — strip Paystack lines so the migration scripts don't require dead secrets.

## 4. Documentation

- Delete `PAYSTACK_SETUP.md`.
- `README.md`, `ONBOARDING.md`, `SUPABASE_SETUP.md`, `MIGRATION.md`, `WEMA_INTEGRATION.md` — strip Paystack instructions; keep a single sentence: "Paystack integration has been deprecated; Wema Bank DVA is the sole payment provider."

## 5. What we deliberately keep (and why)

- Table `paystack_webhook_events`, columns `paystack_reference` / `paystack_customer_code`, index `idx_transactions_paystack_reference`, and SQL helpers `get_unmatched_webhooks` / `get_duplicate_transactions` / `get_orphaned_transactions` / `get_reconciliation_summary` — historical records and audit integrity. Renaming would break existing rows; reconciliation works against the historical names.
- Historical SQL files under `migrations/` and `supabase/migrations/` — they are part of the project's database history and must not be edited.

## 6. Validation before I close the task

- `rg -i "paystack" src/ supabase/functions/ index.html` returns zero hits (excluding the DB identifiers we keep).
- TypeScript build passes (`tsgo`).
- Preview click-through: Sidebar → Webhooks, Reconciliation, Payment Simulator, Transactions, Wallet, Payment Success — no "Paystack" text anywhere, no broken buttons, DVA top-up instructions visible.
- `simulate-payment` still records an event and credits the wallet.
- `wema-webhook` path unaffected.

## Deliverable at the end

1. Audit table of every Paystack reference found and the action taken (replace / delete / keep-with-reason).
2. List of files modified, deleted, edge functions deleted, secrets deleted.
3. Validation report with the `rg` evidence and the build status.
