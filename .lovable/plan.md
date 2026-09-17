# Switch to Dynamic Virtual Accounts (amount in Account Lookup)

Today the Account Lookup reply deliberately leaves out the `amount` field, because the accounts were set up as static. You want dynamic accounts, so the bank sees the exact amount a student still owes when a parent enters the account number.

## What will change

1. **Account Lookup returns a live amount.** When Wema looks up a student's `711` account, the reply will include `amount` alongside the name, status and BVN/NIN. The figure is worked out fresh on every lookup — nothing is cached.

2. **How the amount is worked out (real time):**
   `amount = (school fees + outstanding debt) − money already received into the student's wallet`, never below zero. A student who owes nothing gets `0.00`.

3. **Part payments still welcome.** Any transfer amount is accepted and credited, whether it is less than, equal to, or more than the figure shown. Nothing is rejected on an amount mismatch. After each payment, the next lookup shows the reduced amount automatically.

4. **Documents updated.** `WEMA_HANDOFF.md` and `WEMA_VAS_COMPLIANCE.md` change from "static accounts, no amount field" to "dynamic accounts, amount returned", with a refreshed sample response and a note that part payments are supported. A refreshed Word document for Wema is generated in your Files.

5. **Question flagged for Wema.** The handoff will include an explicit question: *does the Wema banking app let the payer edit the pre-filled amount?* If it does not, dynamic accounts would force parents into a single fixed payment — in that case we would revisit the logic. This is listed as an open confirmation, not assumed.

## Verification

After the change I will call the live lookup endpoint for a student with a zero wallet (expect the full fees), then for a student who already has money in their wallet (expect the reduced figure), and confirm a fresh payment notification lowers the next lookup amount.

## Technical notes

- `supabase/functions/wema-account-lookup/index.ts`: add a wallet-balance read and compute `amount` as `max(0, school_fees + debt_balance − wallet.balance)`, formatted to two decimals as a string, included in the `00` success body. Inactive/invalid paths are unchanged.
- The outstanding calculation lives in a small helper in `supabase/functions/_shared/payments/wema-vas.ts` so mini statement/KYC can reuse it later.
- No schema change, no RLS change, no change to `wema-transaction-notification` amount handling (it already accepts any positive amount and is idempotent on `sessionid`).
