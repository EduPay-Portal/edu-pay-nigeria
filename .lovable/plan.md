## Plan: Paystack TEST-MODE E2E Payment System (Hardened)

Incorporates all critical fixes from review: webhook-only crediting, strict resolution order, DB-level uniqueness, lifecycle status, no secrets in repo.

---

### Guiding invariants (enforced everywhere)

1. **Webhook is the ONLY path that credits wallets.** Frontend success callbacks NEVER mutate balances — they only display state.
2. **Wallet mutations happen exclusively via DB trigger on `transactions`.** No edge function or client writes to `wallets.balance` directly.
3. **Student resolution order** in webhook is strict and logged: `authorization.account_number` → `metadata.student_id` → reject.
4. **Secrets** (`PAYSTACK_SECRET_KEY`) live only in Supabase Edge Function secrets — never in `.env.example`, repo, or client.
5. **All money fields are NOT NULL with explicit defaults.** No optional `type`, `status`, or `amount`.

---

### 1. Database hardening — `migrations/011_payment_hardening.sql`

**a) Enforce non-nullable financial fields**
```sql
ALTER TABLE public.transactions
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL,
  ADD CONSTRAINT transactions_type_check CHECK (type IN ('credit','debit')),
  ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','completed','failed','reversed')),
  ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);
```

**b) Uniqueness on virtual_accounts**
```sql
ALTER TABLE public.virtual_accounts
  ADD CONSTRAINT virtual_accounts_account_number_key UNIQUE (account_number),
  ADD CONSTRAINT virtual_accounts_one_active_per_student
    EXCLUDE (student_id WITH =) WHERE (is_active = true);
```
(Partial unique via `EXCLUDE` allows historical inactive rows; falls back to plain `UNIQUE(student_id) WHERE is_active` if exclude unavailable.)

**c) Wallet auto-credit trigger — webhook-only side-effect**
```sql
CREATE OR REPLACE FUNCTION public.apply_transaction_to_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Only completed transactions affect balance
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF NEW.type = 'credit' THEN
    UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = now()
      WHERE id = NEW.wallet_id;
  ELSIF NEW.type = 'debit' THEN
    UPDATE public.wallets SET balance = balance - NEW.amount, updated_at = now()
      WHERE id = NEW.wallet_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_transaction_to_wallet
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_to_wallet();

-- Also handle status transition pending → completed
CREATE OR REPLACE FUNCTION public.apply_status_change_to_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    IF NEW.type = 'credit' THEN
      UPDATE public.wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
    ELSE
      UPDATE public.wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_apply_status_change_to_wallet
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_status_change_to_wallet();
```
Existing `validate_wallet_balance` trigger continues to block negative balances. Existing `paystack_reference` uniqueness continues to block duplicate webhooks.

**d) Add `provider` + `payment_method` columns** if not present:
```sql
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('card','bank_transfer','simulation')),
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paystack';
ALTER TABLE public.virtual_accounts
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paystack'
    CHECK (provider IN ('paystack','mock'));
```

### 2. Webhook hardening — `supabase/functions/paystack-webhook/index.ts`

- **Strict resolution order** with structured logging:
  1. `data.authorization.account_number` → lookup `virtual_accounts` (active)
  2. fallback: `data.metadata.student_id` → lookup `wallets.user_id`
  3. else → `400` + log to `paystack_webhook_events.error_message`
- **Always** set explicit `type:'credit'`, `status:'completed'`, `payment_method` (`card` if `channel='card'`, else `bank_transfer`), `provider:'paystack'`.
- **Idempotency unchanged** — pre-check `paystack_reference`, plus DB unique constraint as backstop.
- **Signature verification**: keep HMAC-SHA512. Add explicit `if (!PAYSTACK_SECRET_KEY) return 500` so missing secret fails loudly.
- Webhook never updates `wallets` directly — relies on the trigger.

### 3. Paystack inline (frontend) — TEST keys + metadata

- `.env.example`: only the **public** key `VITE_PAYSTACK_PUBLIC_KEY=pk_test_…` (publishable, safe).
- `PAYSTACK_SECRET_KEY` is added via the Lovable Cloud secrets tool **only** (prompt user to confirm before calling `add_secret`). Not committed anywhere.
- `usePaystackPayment` extended:
  ```ts
  initiatePayment({ email, amount, metadata, callback_url, onSuccess, onClose })
  ```
  Sends `metadata.student_id` and `metadata.custom_fields` (Paystack-recommended shape).
- `TopUpWalletDialog`: always include `metadata: { student_id: studentId ?? user.id }` and `callback_url: ${origin}/payment-success?ref={ref}`.

### 4. `/payment-success` page — display-only, never credits

- New `src/pages/PaymentSuccess.tsx`:
  - Reads `?reference=`.
  - Polls `transactions` (where `paystack_reference = ref`) every 2s for **60s** (not 20s).
  - States: `verifying` → `confirmed` (shows new balance) → `pending_confirmation` (after timeout, with **"Refresh status"** button + helpful copy: "Webhook may take a few minutes during peak times. You'll receive a notification when complete.").
  - Includes a "Return to dashboard" CTA always.
- Registered in `src/App.tsx` as a public-then-protected route.
- **Zero balance writes here.** Only reads.

### 5. Mock Virtual Account system (no live DVA needed)

- New edge function `generate-mock-virtual-account` (admin-only):
  - Generates 10-digit `account_number` starting with `80`, retries on collision (DB UNIQUE is authoritative).
  - `provider:'mock'`, `bank_name:'WEMA Bank'`, `account_name:'ASCI - {first} {last}'`, `is_active:true`.
- New edge function `bulk-generate-mock-virtual-accounts` mirroring existing bulk DVA pattern (sequential, 200ms delay — no Paystack calls so no need for 2s).
- Admin button on `StudentsPage` next to existing "Bulk Create DVAs": **"Generate Mock VAs (Test)"**.
- `VirtualAccountCard` and `PaymentInstructions` already render any active row — no change needed.

### 6. Admin "Simulate Payment" — single source of truth

- Existing `simulate-payment` edge function refactored to **call the same internal handler** as the webhook by extracting webhook logic into a shared module (`supabase/functions/_shared/process-payment.ts`).
- Both functions import `processChargeSuccess({ reference, amount, studentId?, accountNumber?, channel, metadata })`.
- Guarantees no logic drift between simulator and real webhook.

### 7. Webhook event audit (already exists, verify completeness)

`paystack_webhook_events` already stores: `event_type`, `paystack_reference`, `payload`, `signature_valid`, `processed`, `error_message`. Add `processed_at TIMESTAMPTZ` if missing, set on completion.

### 8. Transaction lifecycle (forward-compat)

- Webhook still inserts `status='completed'` directly (DVA semantics — money already moved).
- Card path via inline: same — Paystack only fires `charge.success` after success.
- Schema now supports `pending`/`failed`/`reversed` for future authorize-then-capture or refund flows. Trigger handles transitions.

### 9. RLS unchanged

All new tables/columns inherit existing policies. New mock-VA rows pass existing `virtual_accounts` RLS (admin write, student read own, parent read children's via `has_role`).

### 10. QA matrix

| Requirement | Verified by |
|---|---|
| Test card 4084… completes | Inline payment in `TopUpWalletDialog` |
| Webhook signature verified | HMAC-SHA512 in webhook, missing secret = 500 |
| Resolution priority correct | Account-number first, metadata fallback, else reject |
| Transaction created with full lifecycle fields | NOT NULL + CHECK constraints |
| Wallet credited exactly once | DB trigger + `paystack_reference` UNIQUE |
| Duplicate webhook ignored | Pre-check + UNIQUE constraint |
| Negative balance prevented | Existing `validate_wallet_balance` trigger |
| Mock VA unique per student | `EXCLUDE` partial-unique constraint |
| Frontend never credits | `/payment-success` is read-only (code-reviewed) |
| Simulator = webhook | Shared `_shared/process-payment.ts` |
| Secret never in repo | `.env.example` has only public key; secret added via Secrets tool |

---

### Files

**New**
- `migrations/011_payment_hardening.sql`
- `supabase/functions/_shared/process-payment.ts`
- `supabase/functions/generate-mock-virtual-account/index.ts`
- `supabase/functions/bulk-generate-mock-virtual-accounts/index.ts`
- `src/pages/PaymentSuccess.tsx`

**Edited**
- `supabase/functions/paystack-webhook/index.ts` (use shared handler, strict resolution order, lifecycle fields)
- `supabase/functions/simulate-payment/index.ts` (delegate to shared handler)
- `supabase/config.toml` (register new functions)
- `src/hooks/usePaystackPayment.ts` (metadata, callback_url)
- `src/components/dialogs/TopUpWalletDialog.tsx` (send metadata)
- `src/App.tsx` (route)
- `src/pages/dashboard/admin/StudentsPage.tsx` (mock VA bulk button)
- `.env.example` (add public test key only)

### Secrets (added via tool after approval, NOT committed)
- `PAYSTACK_SECRET_KEY` = `sk_test_…` (test mode)

### Out of scope
- Live DVA activation (Paystack support ticket — separate task)
- Refund/reversal UI (schema ready, UI later)
- Email/SMS notifications on payment success
- Switching from inline to Standard redirect

### Memory updates after build
- Update `mem://payment-gateway/paystack/card-topup` to note metadata + callback_url contract.
- Add `mem://database/wallet-credit-trigger` documenting that wallet writes happen ONLY via the trigger.
