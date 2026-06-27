## Goal

Harden the virtual account provisioning pipeline with verified authorization, automatic retries, manual admin re-runs, and scheduled reconciliation.

## 1. Verify create-virtual-account authorization

- Add a Deno test (`supabase/functions/create-virtual-account/index.test.ts`) that:
  - Calls the function with a student JWT → expects HTTP 403 and JSON `{ error, request_id, actor_role: 'student' }`.
  - Calls with a parent JWT → expects 403 with `actor_role: 'parent'`.
  - Calls with an admin JWT → expects 200 and a created/returned virtual account.
- Confirm `VirtualAccountCard.tsx` shows the friendly alert (no blank screen) for non-admins by reading the `actor_role` from the parsed error in `useCreateVirtualAccount`.
- No production code changes expected unless tests reveal a gap.

## 2. Retry with backoff for `provision-student-virtual-account`

Backend:
- Add columns to `virtual_account_provisioning_jobs`: `attempt_count int default 0`, `max_attempts int default 5`, `next_retry_at timestamptz`, `last_attempt_at timestamptz`.
- In `provision-student-virtual-account/index.ts`, wrap the `dva-create` call:
  - On transient failure (network error, HTTP 5xx, Wema timeout), increment `attempt_count`, set `status='pending'`, compute `next_retry_at = now() + interval` using exponential backoff (30s, 2m, 8m, 30m, 2h), persist `last_error`, write audit log entry `provisioning.retry_scheduled`.
  - On terminal failure (4xx from Wema, invalid student) → `status='failed'`, no further retries.
  - On success → `status='completed'`.
- Add a lightweight `provisioning-retry-worker` edge function that selects jobs where `status='pending' AND next_retry_at <= now() AND attempt_count < max_attempts` and invokes `provision-student-virtual-account` per job (service-role).
- Schedule the worker every 2 minutes via `pg_cron` + `pg_net` (using `supabase--insert`, not migrations, since it embeds the project URL/anon key).

Frontend:
- Extend `useVirtualAccountProvisioningJob` to expose `attempt_count`, `next_retry_at`, `last_error`.
- Update `VirtualAccountCard.tsx` to render retry state: "Setting up your account — retry 2 of 5, next attempt in 1m 30s" with a live countdown, and a final "Provisioning failed — contact admin" state when `attempt_count >= max_attempts`.

## 3. Admin re-run button + audit log link

- Add `ProvisioningControls` panel inside `VirtualAccountCard.tsx` (admin-only, gated by `useUserRole`):
  - "Retry provisioning" button → calls `provision-student-virtual-account` with `{ student_id, force: true }`, resets `attempt_count=0`, `status='pending'`.
  - Inline "View audit log" link → navigates to `/dashboard/admin/audit-logs?request_id=<latest_request_id>&student_id=<id>`.
- Update `AuditLogPage.tsx` to read `request_id` and `student_id` query params and pre-filter the table.
- Each manual re-run writes an `audit_logs` row with `action='virtual_account.manual_retry'`, `actor_id`, `request_id`, linked `student_id`.

## 4. Scheduled reconciliation for missing virtual accounts

- New edge function `reconcile-missing-virtual-accounts` (service-role, admin-protected for manual invocation):
  - Selects `student_profiles` where no row exists in `virtual_accounts` AND no active `virtual_account_provisioning_jobs` with `status IN ('pending','processing','completed')`.
  - Enqueues a provisioning job per student (idempotent) and invokes `provision-student-virtual-account`.
  - Writes a summary audit log entry: `reconciliation.virtual_accounts` with counts (`scanned`, `enqueued`, `skipped`).
- Schedule daily at 02:00 UTC via `pg_cron` + `pg_net` (via `supabase--insert`).
- Add an admin-only "Run reconciliation now" button on the existing admin reconciliation/dashboard page that invokes the function and shows the summary result via toast.

## Validation

- Run the new Deno tests for `create-virtual-account` (admin success + non-admin 403 with `actor_role`).
- Manually invoke `provision-student-virtual-account` against a known-failing student to verify retry scheduling and the UI countdown.
- Trigger `reconcile-missing-virtual-accounts` manually as admin and confirm the audit summary plus newly enqueued jobs.
- Confirm non-admin UI never shows a blank screen and admin retry button works end-to-end.

## Technical notes

- All new tables/columns follow the GRANT-then-RLS pattern; jobs table already has admin/student/parent policies — extend them to cover the new columns implicitly (no policy change required).
- All edge functions use the shared `requireAdmin` / `writeAudit` helpers added previously.
- Cron scheduling uses `supabase--insert` (not migrations) per project conventions, since it embeds project URL + anon key.
