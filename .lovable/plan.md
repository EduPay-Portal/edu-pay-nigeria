## Goal

Verify the prior security fixes hold, then add defense-in-depth: an audit dashboard, consistent admin guards everywhere, and automated tests proving unauthorized callers are blocked.

## 1. Re-run security scan

- Call `security--run_security_scan` and review findings.
- Cross-check against the 8 already-fixed internal_ids. Anything new becomes a follow-up item surfaced to you — not auto-fixed in this plan.

## 2. Admin Audit Log Dashboard

The `audit_logs` table and a basic `AuditLogPage` already exist. Upgrade them into a real dashboard.

**Schema additions (migration):**
- Add `request_id text` and `metadata jsonb` columns to `audit_logs` (if not already present beyond current 9 cols — will confirm during build).
- Add index on `(action, created_at desc)` and `(actor_id, created_at desc)`.

**Edge function instrumentation:**
Standardize a helper `_shared/audit.ts` that writes:
- `actor_id`, `action`, `entity_type`, `entity_id`, `request_id` (from `x-request-id` header or generated UUID), `ip` (from `x-forwarded-for`), `metadata`.

Wire it into:
- `admin-create-user` → `user.create`
- `bulk-create-students` → `bulk_create_students.invoked` (exists) + per-student `student.create` + final `bulk_create_students.completed` with counts
- `bulk-create-virtual-accounts` → `bulk_create_virtual_accounts.invoked` + per-VA `virtual_account.create`
- `dva-create` → `dva.create` (exists) + add request_id

**Dashboard UI (`AuditLogPage.tsx`):**
- Filter chips: action category (user creation, bulk import, VA creation, other), date range, actor search.
- Columns: timestamp, action, actor (resolved to email via join), entity, request_id, IP.
- Pagination (50/page) instead of fixed 200 limit.
- Detail drawer showing full `metadata` + `before`/`after` JSON.
- Empty + loading + error states per project conventions.

## 3. Harden role checks

**Frontend (`ProtectedRoute.tsx`):** already denies null roles. Audit `App.tsx` routes to confirm every `/dashboard/admin/*` is wrapped with `allowedRoles={['admin']}`. Fix any gaps.

**`useUserRole` hook:** on error, return `null` explicitly instead of throwing (so ProtectedRoute denies cleanly rather than surfacing a query error).

**Edge functions — standardize via `_shared/auth.ts` helper:**
```
requireAdmin(req, supabaseAdmin) → { user, actorId } | Response(401|403)
```
Returns the 401/403 Response when unauthorized; otherwise the authenticated admin context. Allows service-role bypass only where explicitly opted in (`requireAdminOrServiceRole`).

Apply to every privileged function:
- `admin-create-user`, `bulk-create-students`, `bulk-create-virtual-accounts`, `dva-create`, `dva-reissue`, `create-virtual-account`, `reconcile-transactions`, `simulate-payment`.

Public webhook endpoint `wema-webhook` stays signature-verified, not JWT-gated.

## 4. Automated security tests

Add Deno tests under `supabase/functions/<name>/index.test.ts` using existing dotenv pattern. For each privileged function, assert:

1. No `Authorization` header → 401.
2. Anon key as bearer → 401 (no user).
3. Authenticated non-admin user (signed in with a seeded `student` test account) → 403.
4. Admin user → 200 (smoke; mocked payloads where external calls would happen, or `dry_run` flag).

Test targets: `admin-create-user`, `bulk-create-students`, `bulk-create-virtual-accounts`, `dva-create`, `dva-reissue`, `reconcile-transactions`, `simulate-payment`.

Also add a DB-level test that verifies `anon` and `authenticated` roles cannot `EXECUTE` the SECURITY DEFINER functions hardened previously (uses `has_function_privilege`).

Requires two seeded test users in `.env`:
- `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`
- `TEST_STUDENT_EMAIL` / `TEST_STUDENT_PASSWORD`

If those env vars are missing, tests skip with a clear message rather than fail.

## Technical notes

- One migration for audit_logs columns + indexes.
- One new shared file `supabase/functions/_shared/auth.ts` (admin guard) and `_shared/audit.ts` (writer).
- No DB data changes; only schema + code.
- No frontend dependency changes; reuses shadcn Table, Select, DatePicker, Drawer.

## Out of scope

- Re-doing any of the 8 already-fixed findings.
- Card top-ups / ALATPay (still pending external readiness).
- Webhook signature changes.

## Open question

Do you already have seeded non-admin + admin test accounts I can reference in `.env`, or should the test setup script create them on first run?
