# Full Reset and Student Re-upload

## What a full reset removes (your chosen option)

- All 412 student records and logins, 254 parent accounts and logins.
- All wallets (666) and virtual bank accounts (827).
- All 23 payment records (₦50,100), webhook, settlement, reconciliation and audit history.
- The old staging/upload list (412 rows).

**Kept:** your admin account, all app screens, settings, security configuration and the Wema bank integration. Nothing needs reconfiguring — newly imported students automatically get logins, wallets, fee/debt amounts, membership/boarding status, NIN/BVN/phone where provided, and fresh 711 test virtual accounts.

**Warning:** once deleted, payment history and audit records are unrecoverable. This is safe only because the existing payments are test data.

## Step 0 — Prepare your new file (you)

- Download the template from the Bulk Import page (`student-import-template.csv`).
- Fill it with the current student records: SN, SURNAME, NAMES, CLASS, REG NO, MEMBER/NMEMBER, DAY/BOARDER, SCHOOL FEES, DEBTS, plus optional NIN, BVN, PHONE.
- Share the file with me before upload so I can validate it (reg numbers unique, 11-digit NIN/BVN, valid phone format, no "Not Assigned" rows) before anything is imported.

## Step 1 — Data reset (one approved data wipe)

Run as a single data operation, in dependency order, keeping only admin users:

1. Clear import staging (`students_import_staging`).
2. Delete transactions, then wallets for non-admin users.
3. Delete virtual accounts and their provisioning job queue.
4. Delete webhook events, reconciliation logs, settlements and audit logs (payment history reset, per your choice).
5. Delete student and parent profiles, then the underlying non-admin user accounts (parents and students) — cascading logins, wallets and profiles go with them.
6. Keep: `user_roles` admin row, admin profile, your admin login.
7. Verify counts return to zero for students/parents/accounts and 1 admin.

No app code, schema, RLS or Edge Function changes are needed — this is data only.

## Step 2 — Re-upload and process

- Upload the validated CSV on the Bulk Import page; the system stages all rows.
- Run "Process Staging": creates each student's login, parent login, wallet, profile with fees/debts/membership/boarding/NIN/BVN/phone, and provisions a fresh 711 Wema virtual account per student.

## Step 3 — Verification

- Check staging shows zero errors and all rows processed.
- Confirm student count matches the CSV row count.
- Confirm each new student has one active 711 virtual account (spot-check a few on the Students page and DVA Management).
- Sign in as one new student to confirm wallet, virtual account and fees display correctly.

## Notes

- Demo logins `ascistudent@gmail.com` / `asciparent@gmail.com` created earlier will also be deleted by the full reset — tell me if you want them recreated after the import.
- Old virtual account numbers are retired; parents must use the new account numbers shown on each student's dashboard.
