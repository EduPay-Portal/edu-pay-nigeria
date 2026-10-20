# Fix data sync, test/live separation, and add "Issue VA" for new students

## Goal
Make the admin dashboards show what actually came in, keep simulator payments separate from live money, and let admins issue virtual accounts to newly onboarded students. Then update the live site at pay.ahmadiyyasciencecollege.ng.

## What will change (in plain terms)

1. **Settlements page**
   - Add a "Today's inflow (awaiting bank settlement)" panel built from live completed payments, so money shows immediately instead of waiting for Wema's settlement file.
   - Keep the existing "Settlements" table for real bank settlement records only.
   - Auto-refresh every 30 seconds and when you return to the tab.

2. **Test vs live separation**
   - Simulator payments (references starting `TEST_`) are excluded from all live totals: Settlements, Transactions stats, Dashboard, Reconciliation.
   - A "Show simulations" toggle on Transactions and Webhooks lets you still view them, clearly labelled "Simulation".

3. **Transactions and Webhooks pages**
   - Webhooks page shows both Wema payment notifications and card (Paystack) events, not only card events, with a source filter.
   - Transactions page refreshes automatically when a new payment is recorded.

4. **Students page stat cards**
   - Fix the cards showing 0 while student rows exist: totals load correctly for all staff roles allowed on the page, with a fallback count if the summary fails.

5. **Virtual Accounts page: students without an account**
   - New "Students without a virtual account" section listing onboarded students missing an active 904 account, with reason (missing name, pending, failed attempt).
   - "Issue VA" button per student and "Issue for all (batch of 50)" — admin/superadmin only, using the existing Wema-standard 904 numbering and naming (`ASCI/<Name>`).
   - Counters: With VA / Without VA / Blocked.

6. **Security tightening**
   - Re-issue and retire-legacy actions also checked on the server for admin role (today only the buttons are hidden).

7. **Automated access tests**
   - Check that admin and superadmin can open the Webhooks, Reconciliation and Payment Simulator pages and see the Re-issue / Retire buttons.
   - Check that principal, bursar, registrar and auditor are blocked from those pages, including when they type the page address directly, and don't see those buttons.
   - Check on the server that only admins can run re-issue / retire actions.

## Not changing
- Wema endpoints (lookup, notification, KYC, mini statement, block), tokens, 904 prefix, collection account.
- Existing student/parent access.

## Rollout to pay.ahmadiyyasciencecollege.ng
1. Build and test in preview (with simulator payments to confirm they stay out of live totals).
2. Database updates applied to your live backend — I will need a fresh short-lived access token, revoke it after.
3. You redeploy on Vercel (without cache); I then check the live pages.

## Technical details
- New DB view/function `get_live_inflow_summary(date)` (SECURITY DEFINER, staff roles via `private.has_role`) aggregating `transactions` where `status='completed'`, `type='credit'`, excluding `reference/paystack_reference LIKE 'TEST_%'` and `metadata->>'simulated'='true'`.
- React Query for Settlements with `refetchInterval` + `refetchOnWindowFocus`; invalidate transaction/settlement keys via a realtime subscription on `transactions` inserts.
- Webhooks page unions `webhook_events` (Wema) and `paystack_webhook_events`, merged client-side.
- `get_student_stats` extended to all roles in `ADMIN_PAGE_ROLES.students`; client fallback to count query.
- Missing-VA list: separate queries on `student_profiles`, `profiles`, `virtual_accounts`, `virtual_account_provisioning_jobs`, merged client-side; issuance calls existing `provision-student-virtual-account` / `dva-create` functions.
- Add `requireRole(['admin'])` in `dva-reissue` and `dva-retire-legacy`; deploy those two functions only.
- Add tests: TEST_ exclusion from live summary; non-admin rejected by reissue functions.
- Access tests (Vitest + Testing Library, set up if missing): mock `useUserRole` per role, render routes through `ProtectedRoute` via `MemoryRouter` at `/dashboard/admin/webhooks`, `/reconciliation`, `/simulator`, `/dva`; assert admin renders and principal/bursar/registrar/auditor redirect; assert `dvaActions` buttons visible only for admin; unit test `ADMIN_PAGE_ROLES` entries. Deno tests for `dva-reissue`/`dva-retire-legacy` returning 403 for non-admin roles.
