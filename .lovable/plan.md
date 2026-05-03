## Frontend Completion: Payment Success, Mock VA, Metadata Wiring

Three coordinated changes to finish the Paystack hardening loop in the UI/edge layer. No schema changes — the trigger-driven wallet flow from migration 011 is already live.

### 1. Mock Virtual Account generator (test-mode short-circuit)

`supabase/functions/create-virtual-account/index.ts`

The Paystack DVA endpoint requires the live "Dedicated Virtual Account" feature, which is disabled on this Paystack account (per existing memory `paystack/account-constraints`). Add a mock branch so the entire flow works end-to-end without it:

- Read `PAYSTACK_DVA_ENABLED` env (default `"false"`).
- When disabled, skip the Paystack customer + DVA calls and synthesize:
  - `account_number`: `TEST` + 6-char hash of `student_id` (always 10 chars total, deterministic per student)
  - `account_name`: `TEST - {first_name} {last_name}`
  - `bank_name`: `Test Sandbox Bank`
  - `bank_code`: `TEST`
  - `paystack_customer_code`: `CUS_TEST_<6char>`
- Insert into `virtual_accounts` exactly as the live path does (the DB shape is identical, so `paystack-webhook` resolution by `account_number` still works for simulated charges).
- Live path is preserved as-is for when the user enables DVA in production.

This unblocks `bulk-create-virtual-accounts` and the auto-creation trigger.

### 2. Wire `metadata.student_id` into card top-ups

`src/hooks/usePaystackPayment.ts` and `src/components/dialogs/TopUpWalletDialog.tsx`

The shared `process-payment.ts` resolver already reads `studentId` as the secondary path. The frontend currently doesn't send it.

- Extend `PaystackConfig` with `metadata?: Record<string, unknown>`.
- Pass `metadata` through to `window.PaystackPop.setup({ metadata: { student_id, ... } })`.
- In `TopUpWalletDialog`, pass `metadata: { student_id: studentId ?? user.id }` when calling `initiatePayment` for the card path.
- Generate the reference client-side as `LIVE_<timestamp>_<rand>` (so test simulations stay clearly tagged with `TEST_` and live charges have their own prefix), and pass it into both Paystack and onSuccess so we can navigate to `/payment-success?reference=…`.

### 3. `/payment-success` polling page

New file `src/pages/PaymentSuccess.tsx` + route in `src/App.tsx`.

- Read `?reference=` from the URL.
- Poll `transactions` by `paystack_reference` every 2 s for up to 20 s (10 attempts).
- States:
  - `polling` — spinner + "Confirming your payment…" + reference shown
  - `success` — green check, amount, new wallet balance, "Back to Dashboard" CTA (route depends on user role)
  - `timeout` — yellow warning, "Still processing — your wallet will update shortly. Check Transactions." with manual refresh button
- On success, also `queryClient.invalidateQueries(['wallet'])` and `['transactions']`.
- After redirect from Paystack inline (current dialog calls `onSuccess` with the reference), navigate via `react-router` `useNavigate` to `/payment-success?reference=…` instead of just toasting.

Update `TopUpWalletDialog.handlePayment.onSuccess` to `navigate(\`/payment-success?reference=${reference}\`)` and close the dialog.

Add the route to `App.tsx` inside the protected tree (any authenticated user — students, parents, admins all top up).

### 4. Simulator polish (already mostly done)

- The simulator already calls `simulate-payment` edge function (which uses `_shared/process-payment.ts`).
- Add a yellow "TEST MODE" banner above the page header that reads "All payments here use TEST_ references and never touch real money."
- Replace the existing single `Test Mode` badge — it's currently subtle.

### Verification (after deploy)

1. Create a student (auto-trigger creates a TEST_ virtual account)
2. Open `/dashboard/admin/payment-simulator`, simulate ₦5,000 → wallet credited via trigger, transaction shown
3. As a student/parent, open Top Up dialog → card path → Paystack test card → redirected to `/payment-success?reference=…` → polling resolves → balance updated
4. Bank-transfer path shows the TEST_ account number with "sandbox" disclaimer

### Files touched

- `supabase/functions/create-virtual-account/index.ts` — mock branch
- `src/hooks/usePaystackPayment.ts` — metadata + reference passthrough
- `src/components/dialogs/TopUpWalletDialog.tsx` — pass metadata, navigate to success page
- `src/pages/PaymentSuccess.tsx` — new
- `src/App.tsx` — register route
- `src/pages/dashboard/admin/PaymentSimulatorPage.tsx` — TEST MODE banner

Approve to switch to build mode and apply.