# Refresh the Wema handoff pack

The handoff sheet still lists the old test accounts (`7110234567`–`7110234576`), which no longer exist — the student data was fully reset and re-imported on 2026-09-17. The live sandbox now holds 16 active `711` accounts (15 SS 3 students plus the demo student), none blocked.

## 1. Re-verify the five endpoints live

Run the same end-to-end checks against the current accounts, using the saved bearer token (never shown in chat or written to a file):

- Account Lookup on a real current account → expect `00` with name and BVN/NIN
- Transaction Notification (small test credit) → expect `00`, wallet credited
- Duplicate notification with the same `sessionid` → expect `00`, no second credit
- Mini Statement → expect `00` with the test credit listed
- KYC Details → expect `00` with name, phone, NIN, balance, status
- Block Account on one designated test account → expect `00`, then lookup returns `07` Inactive
- Wrong token → expect HTTP 401 with `96`

The blocked test account will be a single dedicated one (the demo student account), left blocked or unblocked per your preference after testing.

## 2. Update `WEMA_HANDOFF.md`

- Replace the sample-account table with real, current `711` accounts and names
- Update all example requests/responses to use those live account numbers
- Update the verification log with today's date and results
- Note that NIN is now captured per student from the import (BVN still blank; sandbox fallback used where missing)
- Keep the bearer token as a placeholder — shared separately

## 3. Update `WEMA_VAS_COMPLIANCE.md`

Refresh account counts (16 active `711` accounts), the verification date, and the remaining open items with Wema.

## 4. Produce a simple document to send to Wema

A clean, self-contained Word document saved to your Files, written for the bank's testing team:

- Vendor and environment summary
- Base URL and authentication instructions
- The five endpoints with one sample request and response each
- Status code table
- List of test virtual accounts
- Notes and the items Wema still needs to confirm
- Token left as a clearly marked blank to be shared over a secure channel

## Technical details

- Files edited: `WEMA_HANDOFF.md`, `WEMA_VAS_COMPLIANCE.md`. No code or schema changes.
- Verification uses direct calls to the deployed functions; the token value is never printed or committed.
- The Word document is generated to `/mnt/documents` so you can download and forward it directly.
