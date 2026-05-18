
# Migration Plan: Move EduPay Connect Off Lovable

Goal: Take 100% ownership of the codebase, backend, and deployment. After this plan, Lovable is no longer required to develop, deploy, or operate the platform.

## End-State Architecture

```text
GitHub (source of truth)
   │
   ├──> Vercel  ───────────────►  Frontend (React/Vite) at your custom domain
   │
   └──> Supabase CLI ──────────►  YOUR Supabase project (eu-west-2 or af-south-1)
                                     ├─ Postgres + RLS + triggers + functions
                                     ├─ Auth (email + Google)
                                     ├─ Edge functions (dva-create, wema-webhook, ...)
                                     └─ Vault (Paystack, Wema, service-role secrets)

Paystack + Wema dashboards ──webhooks──► new Supabase function URLs
```

## Deliverables

1. `MIGRATION.md` committed to the repo — full runbook, copy-paste commands
2. `/mnt/documents/edupay_migration_runbook.pdf` — printable runbook for stakeholders
3. `/mnt/documents/edupay_migration_runbook.docx` — editable version
4. `scripts/migration/` folder in the repo with helper bash scripts:
   - `01_export_schema.sh` — dump schema from Lovable Cloud
   - `02_export_data.sh` — `pg_dump --data-only` of all public tables
   - `03_restore_to_new.sh` — restore schema + data into new Supabase project
   - `04_deploy_functions.sh` — `supabase functions deploy` for all 9 functions
   - `05_set_secrets.sh` — template to push secrets via `supabase secrets set`
   - `06_gen_types.sh` — regenerate `src/integrations/supabase/types.ts`
   - `07_smoke_test.sh` — curl the new endpoints to verify

## Migration Phases (the runbook will detail each)

### Phase 0 — Preparation (Day 0, ~2 hours)
- Connect Lovable project to GitHub (Plus → GitHub → Connect)
- Clone the repo locally; verify `npm install && npm run dev` works against current backend
- Install tooling: Node 20+, Supabase CLI, PostgreSQL client (`psql`, `pg_dump`), Vercel CLI
- Inventory of what to migrate (auto-generated in runbook):
  - 14 public tables (admin_profiles, audit_logs, parent_profiles, paystack_webhook_events, profiles, reconciliation_logs, settlements, student_profiles, students_import_staging, transactions, user_roles, virtual_accounts, wallets, webhook_events)
  - 18 DB functions + triggers (handle_new_user, has_role, apply_transaction_to_wallet, validate_wallet_balance, check_transaction_idempotency, etc.)
  - 9 edge functions (dva-create, wema-webhook, paystack-webhook, bulk-create-students, bulk-create-virtual-accounts, create-virtual-account, dva-reissue, reconcile-transactions, simulate-payment)
  - 7 runtime secrets (PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, plus Wema creds when issued)
  - Auth providers: Email + Google OAuth
- Take a full backup of Lovable Cloud DB before touching anything

### Phase 1 — Provision New Supabase Project (Day 1 morning, ~1 hour)
- Create new Supabase project, region close to Nigeria (recommend `eu-west-2` London — best latency + Wema/Paystack proximity)
- Save: project ref, anon key, service role key, DB password, pooler + direct connection strings
- `supabase login` and `supabase link --project-ref <NEW_REF>`

### Phase 2 — Schema Migration (Day 1 afternoon, ~2 hours)
- Two routes; runbook covers both:
  - **Route A (cleanest):** Re-apply the 11 migration files already in `supabase/migrations/` to the new project via `supabase db push`. Verify table list and RLS policies match.
  - **Route B (safety net):** `pg_dump --schema-only` from Lovable Cloud, diff against Route A, apply any drift as a new migration.
- Run `supabase--linter` equivalent locally to catch RLS gaps

### Phase 3 — Data Migration (Day 1 evening, ~1–4 hours depending on data volume)
- `pg_dump --data-only --no-owner --no-acl` from Lovable Cloud Postgres
- `psql` restore into new project
- Critical: re-create `auth.users` rows via Supabase Admin API or `pg_dump auth.users` (passwords are bcrypt hashes — they migrate intact)
- Reset Postgres sequences (`transaction_ref_seq`, `student_admission_seq`)
- Verify row counts table-by-table

### Phase 4 — Edge Functions & Secrets (Day 2 morning, ~2 hours)
- `supabase functions deploy` all 9 functions to new project
- `supabase secrets set` all 7 runtime secrets (user supplies values from Lovable Cloud secrets vault)
- Configure auth: enable Google OAuth (re-add client ID + secret), set Site URL + redirect URLs
- Enable leaked-password (HIBP) check + email confirmation

### Phase 5 — Frontend on Vercel (Day 2 afternoon, ~1 hour)
- Import GitHub repo into Vercel
- Set env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) to new project values
- Verify `vercel.json` rewrites work (already in repo)
- Deploy to a `.vercel.app` URL first; smoke-test login, dashboards, DVA creation
- Attach custom domain; lower DNS TTL beforehand

### Phase 6 — Cut Over Webhooks (Day 2 evening, ~30 min — coordinated)
- Update Paystack dashboard webhook URL → new Supabase function URL
- Update Wema dashboard webhook URL (once live) → new function URL
- Update Wema IP allowlist secret to match new outbound IP (if static IP/NAT proxy is added later)
- Send test webhook from each provider; verify in `webhook_events` table

### Phase 7 — Verification & Decommission (Day 3, ~half day)
- Run `07_smoke_test.sh`: signup, login, create DVA, simulate payment, view transaction, run reconciliation
- Monitor for 24–48h with both backends warm (Lovable Cloud read-only as fallback)
- After 7 days of clean operation: remove Lovable Cloud project, remove Lovable GitHub App if you don't want auto-sync anymore

## Technical Details (for the engineer doing the work)

### Connection strings format
```text
Direct:  postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres
Pooled:  postgresql://postgres.[REF]:[PASS]@aws-0-[region].pooler.supabase.com:6543/postgres
```
Use **direct** for `pg_dump` / `pg_restore`; **pooled** for app runtime.

### Edge function URL pattern
```text
https://[NEW_REF].supabase.co/functions/v1/[function-name]
```
Both Paystack and Wema must be updated.

### Files Lovable auto-generates that you now own
- `src/integrations/supabase/client.ts` — keep, points at env vars, fine as-is
- `src/integrations/supabase/types.ts` — regenerate via `supabase gen types typescript --project-id <NEW_REF> > src/integrations/supabase/types.ts`
- `supabase/config.toml` — update `project_id` to new ref
- `.env` — point at new project

### What stops working without Lovable
- The Lovable AI editor (use Cursor or VS Code + Copilot)
- Lovable Cloud Secrets UI (use Supabase Vault directly)
- Auto-refresh of `types.ts` after migrations (run `06_gen_types.sh` manually)
- One-click publish (replaced by `git push` → Vercel auto-deploy)

### What keeps working unchanged
- All React/Vite code, Tailwind, shadcn components
- All RLS policies, triggers, edge functions (literally copy-pasted to new project)
- Paystack inline checkout, Wema webhook flow, audit logs, reconciliation
- Existing user passwords (auth.users migration preserves bcrypt hashes)

## Rollback Plan
If anything fails post-cutover within the 48h window:
1. Revert Paystack + Wema webhook URLs to Lovable Cloud endpoints
2. Revert Vercel env vars to old project
3. Lovable Cloud is still running and untouched — instant fallback

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Password hashes don't migrate cleanly | Use `pg_dump` on `auth.users` table specifically; test with one user before bulk |
| Webhook gap during cutover | Coordinate cutover during low-traffic window; queue webhooks at provider level (Paystack retries 72h) |
| Static IP allowlist breaks Wema | Add NAT proxy (see existing security assessment P0 #4) before going live with Wema |
| Sequence values reset | Explicitly `SELECT setval()` for `transaction_ref_seq` and `student_admission_seq` |
| Google OAuth redirect mismatch | Update OAuth client allowed redirect URIs to new Supabase project URL |

## Estimated Effort
- Solo engineer with Supabase experience: **2–3 working days**
- Calendar time recommended: **1 week** (includes 48h dual-run verification)

## Next Step After Approval
I will:
1. Generate `MIGRATION.md` in the repo root
2. Generate the 7 helper bash scripts under `scripts/migration/`
3. Generate PDF + DOCX runbooks in `/mnt/documents/`
4. QA the PDF (render to images, check every page)
