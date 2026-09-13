# Fix: 711 test account numbers, and where the compliance report lives

## 1. The compliance report

`WEMA_VAS_COMPLIANCE.md` does exist — it sits at the top level of the project, alongside `README.md`. If you are looking on GitHub or on your computer and cannot see it, your copy is simply behind; it appears after the latest changes sync across.

No work needed here unless you would prefer it somewhere more visible.

## 2. Why no account shows the 711 prefix

Checked the live data:

- 414 virtual accounts in total
- 412 start with a `9` — these are the old placeholder numbers created in June, before the Wema rebuild
- 0 start with `711`
- The number generator added during the rebuild has never been used once

So nothing is broken in the new code — the old accounts were simply never replaced. Every account on the Virtual Accounts screen predates the new rules.

The existing "re-issue" action cannot fix this on its own: it skips any student who already has an active account, which is all 412 of them.

## What to build

**Retire and reissue.** A one-time admin action that, for each student holding an old `9...` account:

1. Marks the old account as retired (kept for history, no longer active, never shown as payable).
2. Issues a fresh `711`-prefixed account through the new generator.
3. Records every step in the audit log.

Students keep their history; only the number they are told to pay into changes.

**Guardrails**

- Skips any student who already has a `711` account, so it is safe to run twice.
- Runs in batches with a progress summary, the same way bulk creation already works.
- Admin-only, as with the other virtual-account actions.

**On the Virtual Accounts admin screen**

- A "Retire & reissue legacy accounts" button with a confirmation step naming how many accounts will change.
- A small banner showing how many accounts are still on an old prefix, so you can see progress to zero.
- Retired accounts shown with a clear "retired" status instead of "active".

## Technical notes

- New edge function `dva-retire-legacy` (admin-guarded, service-role writes): selects `virtual_accounts` where `account_number` does not start with the configured prefix, sets `status = 'retired'`, `is_active = false`, `account_status = 'inactive'`, then calls `dva-create`, which already draws from `allocate_virtual_account_number()`.
- Requires widening the `virtual_accounts.status` check constraint to allow `retired`, via migration.
- `dva-create`'s existing-account guard must treat retired rows as absent so a new row can be created; the unique index is on `account_number`, so both rows coexist.
- Frontend: extend `src/pages/dashboard/admin/DVAManagementPage.tsx` with the legacy count query, the action button and a progress/result panel, reusing the bulk-creation hook pattern.
- The bank-facing lookup and notification endpoints already reject anything outside the configured prefix, so retired numbers stop being payable the moment they are retired.

## Before running it

Anyone already holding an old account number must be told the new one. Worth timing the switch and sending the new numbers out, since transfers to a retired number will be rejected.
