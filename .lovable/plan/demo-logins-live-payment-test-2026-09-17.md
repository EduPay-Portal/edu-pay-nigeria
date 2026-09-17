# Demo logins + live payment test

## Goal
1. Recreate the demo student and parent logins that the data reset removed.
2. Put a real payment through one of the new SS 3 students' 711 accounts and confirm the money lands in the wallet.

## What gets created

**Demo student** — `ascistudent@gmail.com` / `DemoStudent123!`
- Email confirmed, student role, own wallet, own active 711 virtual account
- Class SS 3, demo admission and registration number, sample fees

**Demo parent** — `asciparent@gmail.com` / `DemoParent123!`
- Email confirmed, parent role, own wallet
- Linked as the parent of the demo student, so signing in as the parent shows the child, the child's 711 account and the child's payment history

Existing student/parent links are left untouched — no real family's parent record is reassigned.

## The payment test

A payment is pushed through the same path a real bank transfer takes, not a shortcut:

```text
Payment into 711 account
        |
  bank notification endpoint
        |
  checks account is real + active
        |
  records the transaction
        |
  wallet balance goes up
```

Steps:
1. Pay into the demo student's 711 account (a ₦25,000 test transfer credited from the demo parent).
2. Confirm the endpoint accepts it once and records a completed credit transaction.
3. Re-send the same payment to confirm it is not double-counted.
4. Confirm the wallet balance and the transaction history both show ₦25,000.
5. Repeat one payment into a real SS 3 student's 711 account (Abdulbasit Abdulsalam, 7110234980) to prove the live records reconcile too, then report the balance.

Both test payments are real rows in your live records. Say the word and I can reverse the one against the real student afterwards.

## Technical notes
- Accounts created through the existing admin user-creation function so roles, wallets, profiles and virtual accounts follow the normal triggers and provisioning queue.
- Payment injected via `wema-transaction-notification` with the vendor bearer token, exercising auth, account lookup, idempotency key and wallet trigger.
- Verification by direct reads of `transactions`, `wallets` and `virtual_accounts`.
- No schema, RLS or function code changes.
