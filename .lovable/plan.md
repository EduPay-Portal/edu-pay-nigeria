# Reset and Import 15 SS 3 Students

## Your file — review result

`student-ss3-import.csv` has the correct columns and 15 SS 3 students. Checks:

- Registration numbers: all present and unique. Good.
- Class, member and day/boarder values: all valid.
- School fees: ₦145,500 (day) and ₦298,500 (boarder); debts all 0. Good.
- NIN: all 15 present and 11 digits. Good.
- BVN: blank for all 15 — allowed; the sandbox fallback identity is used for now, but real BVNs are needed before going live.
- Phone: 13 numbers are missing the leading zero (e.g. `8060164991`). These will be corrected to `08060164991` during import. Two rows (Adeyemi, Ogundeji) have no phone — left blank.

## Step 1 — Full reset

The earlier wipe never ran, so the app still holds all the old data. Remove everything except your admin account:

- All 412 students and 254 parents, their logins and profiles
- All 666 wallets and 827 virtual accounts, plus the provisioning queue
- All 23 payment records, webhook events, settlements, reconciliation and audit history
- The old 412-row upload staging list
- Restart admission numbering from 1

Kept: your admin login and profile, all app settings, security rules and the Wema bank integration. This cannot be undone.

## Step 2 — Import the 15 students

- Load the corrected file (leading zeros added to phones) into the import staging area.
- Run the student creation process: each row gets a student login, a parent login, a wallet, and a profile carrying class, registration number, fees, membership and boarding status, NIN and phone.
- Each student is automatically provisioned a fresh 711 test virtual bank account with Wema.

## Step 3 — Verification

- Confirm 15 students, 15 wallets, and 15 active 711 virtual accounts, zero import errors.
- Spot-check a student record on the Students page: fees, class, NIN and account number correct.
- Confirm the admin dashboard totals reflect 15 students and the new fee totals.

## Notes

- The demo logins `ascistudent@gmail.com` and `asciparent@gmail.com` will be removed by the reset. Say the word and I'll recreate them afterwards.
- Only SS 3 will exist in the app after this. Other classes can be uploaded the same way whenever you're ready — no reset needed for those.
- Parent logins are generated from each surname, one per family, as before.
