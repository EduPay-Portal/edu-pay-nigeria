# Static Accounts with an Outstanding-Balance Pre-fill

We stay on **static virtual accounts** — each student keeps one permanent `711` account that can receive many payments across the term. The only change is that Account Lookup now also returns the student's live outstanding balance, so the bank can pre-fill a suggested amount.

## What will change

1. **Account Lookup returns `amount`.** Alongside the account name, status and BVN/NIN, the reply includes the amount the student still owes, worked out fresh on every single lookup.

2. **How the amount is worked out (real time):**
   `amount = (school fees + outstanding debt) − money already received into the student's wallet`, floored at zero. A student who owes nothing gets `0.00`.

3. **Instalments stay fully supported.** The amount is only a suggestion. Any transfer, smaller or larger, is accepted and credited exactly as it is today — nothing is rejected for not matching. Each payment lowers the figure the next lookup returns.

4. **Documents updated.** `WEMA_HANDOFF.md` and `WEMA_VAS_COMPLIANCE.md` will state: static accounts, `amount` returned as an outstanding-balance pre-fill, part payments supported. Sample responses refreshed with real current figures, and a refreshed Word document generated in your Files to send to Wema.

## Question to put to Wema (unconfirmed)

I could not verify this from Wema's published material, so it will go to them in writing as an open item rather than be assumed:

> On a static virtual account, when the Account Lookup response carries an `amount`, can the payer edit/override that pre-filled amount in the Wema banking app to make a partial instalment payment — or is the transfer locked to the returned amount?

If Wema confirms the amount is locked, we simply stop returning `amount` and go back to a pure static response — a one-line change, and the handoff will say so.

## Verification

Call the live lookup for a student with an empty wallet (expect the full fees), then for one who has already paid in (expect the reduced figure), and confirm a fresh payment notification lowers the next lookup amount.

## Technical notes

- `supabase/functions/wema-account-lookup/index.ts`: read the student's wallet balance, compute `amount` as `max(0, school_fees + debt_balance − wallet.balance)` as a two-decimal string, include it in the `00` success body only. Invalid/inactive responses unchanged.
- Calculation lives in a helper in `supabase/functions/_shared/payments/wema-vas.ts` so other endpoints can reuse it.
- No schema change, no RLS change, no change to `wema-transaction-notification` (already accepts any positive amount, idempotent on `sessionid`).
