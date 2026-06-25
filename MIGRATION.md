# EduPay Connect — Migration Out of Lovable

> **DEPRECATION NOTICE (2026):** Paystack integration has been deprecated; Wema Bank DVA is the sole payment provider. Any Paystack secrets, webhooks, or function references below can be skipped during migration.

Complete runbook for moving the platform off Lovable to a self-managed stack:
**GitHub + Vercel + your own Supabase project.**



After completing this guide, Lovable is no longer required to develop, deploy,
or operate EduPay Connect.

---

## Target Architecture

```
GitHub (source of truth)
   │
   ├──> Vercel  ───────────────►  Frontend (React/Vite) at your custom domain
   │
   └──> Supabase CLI ──────────►  YOUR Supabase project
                                     ├─ Postgres + RLS + triggers + functions
                                     ├─ Auth (email + Google)
                                     ├─ Edge functions (9 functions)
                                     └─ Vault (Paystack, Wema, service-role)

Paystack + Wema dashboards ──webhooks──► new Supabase function URLs
```

---

## Inventory (what is being moved)

| Asset | Count | Where |
|---|---|---|
| Public tables | 14 | `supabase/migrations/*.sql` |
| DB functions + triggers | 18 | embedded in migrations |
| Edge functions | 9 | `supabase/functions/*` |
| Runtime secrets | 7 | Lovable Cloud Secrets → new Supabase Vault |
| Auth providers | 2 | Email + Google |
| Frontend | React + Vite + Tailwind + shadcn | `src/` |

**Edge functions to migrate:** `dva-create`, `wema-webhook`, `paystack-webhook`,
`bulk-create-students`, `bulk-create-virtual-accounts`, `create-virtual-account`,
`dva-reissue`, `reconcile-transactions`, `simulate-payment`.

**Secrets to migrate:** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`,
plus Wema credentials once issued (`WEMA_API_KEY`, `WEMA_WEBHOOK_SECRET`,
`WEMA_ALLOWED_IPS`, `WEMA_BASE_URL`).

> Note: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
> `SUPABASE_DB_URL`, `SUPABASE_JWKS` are auto-provisioned by the new Supabase
> project — do **not** copy them from Lovable.
> `LOVABLE_API_KEY` is Lovable-specific and not needed after migration.

---

## Prerequisites (local machine)

```bash
# Node 20+
node --version

# Supabase CLI
npm install -g supabase
supabase --version

# Postgres client (pg_dump / psql)
# macOS:  brew install postgresql@16
# Ubuntu: sudo apt install postgresql-client-16

# Vercel CLI (optional but useful)
npm install -g vercel
```

Have ready:
- Lovable Cloud DB connection string (request from Lovable support if not visible)
- A GitHub account with admin rights to create a new repo
- A Supabase account
- A Vercel account
- Paystack dashboard access
- Wema Bank dashboard access (once live)

---

## Phase 0 — Preparation (~2 hours)

### 0.1 Push your Lovable project to GitHub
In Lovable: **Plus (+) → GitHub → Connect project → Create Repository**.
Lovable will push the full codebase and keep it in 2-way sync.

### 0.2 Clone the repo locally
```bash
git clone https://github.com/<your-org>/edupay-connect.git
cd edupay-connect
npm install
cp .env.example .env
# Fill .env with CURRENT Lovable Cloud values to test locally
npm run dev   # http://localhost:8080 — should work against current backend
```

### 0.3 Take a full backup of Lovable Cloud DB
Run the export scripts (see below) **before** changing anything.

---

## Phase 1 — Provision the New Supabase Project (~1 hour)

1. Go to https://supabase.com → **New Project**
2. Region: **`eu-west-2` London** (best latency + compliance fit for Nigeria)
3. Save these values in a password manager:
   - Project Ref (e.g. `abcdefghijklmnop`)
   - Anon key (`eyJhbGci...`)
   - Service role key (`eyJhbGci...`)
   - DB password
   - Direct DB connection string
   - Pooled DB connection string
4. Login + link:
   ```bash
   supabase login
   supabase link --project-ref <NEW_REF>
   ```

---

## Phase 2 — Schema Migration (~2 hours)

The cleanest path is to **re-apply the existing migration files** in
`supabase/migrations/` — they are version-controlled and already represent the
full schema.

```bash
# Update supabase/config.toml first:
#   project_id = "<NEW_REF>"

supabase db push
```

Verify:
```bash
supabase db remote commit   # should show no drift
psql "$NEW_DIRECT_URL" -c "\dt public.*"  # expect 14 tables
psql "$NEW_DIRECT_URL" -c "\df public.*"  # expect 18 functions
```

If you see drift, dump the schema from Lovable Cloud and diff:
```bash
pg_dump "$OLD_DIRECT_URL" --schema-only --schema=public --no-owner --no-acl > old_schema.sql
pg_dump "$NEW_DIRECT_URL" --schema-only --schema=public --no-owner --no-acl > new_schema.sql
diff old_schema.sql new_schema.sql
```
Apply any drift as a new migration file under `supabase/migrations/`.

---

## Phase 3 — Data Migration (~1–4 hours)

> **Critical:** the `auth.users` table contains bcrypt password hashes. They
> migrate intact when dumped/restored — users will keep their existing passwords.

### 3.1 Dump data from Lovable Cloud
```bash
bash scripts/migration/02_export_data.sh \
  "$OLD_DIRECT_URL" \
  ./migration-dump
```

This produces:
- `migration-dump/auth_users.sql`
- `migration-dump/public_data.sql`

### 3.2 Restore into new project
```bash
bash scripts/migration/03_restore_to_new.sh \
  "$NEW_DIRECT_URL" \
  ./migration-dump
```

### 3.3 Reset sequences
```bash
psql "$NEW_DIRECT_URL" <<SQL
SELECT setval('public.transaction_ref_seq',  (SELECT COALESCE(MAX(SUBSTRING(reference FROM '\d+$')::INT),1) FROM public.transactions));
SELECT setval('public.student_admission_seq',(SELECT COALESCE(MAX(SUBSTRING(admission_number FROM '\d+$')::INT),1) FROM public.student_profiles));
SQL
```

### 3.4 Row-count verification
```bash
for t in profiles user_roles student_profiles parent_profiles admin_profiles \
         wallets virtual_accounts transactions webhook_events \
         paystack_webhook_events reconciliation_logs settlements \
         audit_logs students_import_staging; do
  echo "== $t =="
  psql "$OLD_DIRECT_URL" -tAc "SELECT COUNT(*) FROM public.$t"
  psql "$NEW_DIRECT_URL" -tAc "SELECT COUNT(*) FROM public.$t"
done
```
Counts must match exactly.

---

## Phase 4 — Edge Functions & Secrets (~2 hours)

### 4.1 Deploy all 9 functions
```bash
bash scripts/migration/04_deploy_functions.sh
```

### 4.2 Push runtime secrets
Edit `scripts/migration/05_set_secrets.sh`, paste real values, then:
```bash
bash scripts/migration/05_set_secrets.sh
```

### 4.3 Configure auth (Supabase Dashboard → Authentication)
- **URL Configuration:** Site URL = `https://<your-domain>`; add redirect URLs
  for `localhost:8080`, `<project>.vercel.app`, and your custom domain
- **Providers → Google:** enable, paste OAuth Client ID + Secret
  - Update the Google Cloud Console OAuth redirect to:
    `https://<NEW_REF>.supabase.co/auth/v1/callback`
- **Providers → Email:**
  - Enable email confirmation
  - **Enable "Password HIBP Check"** (leaked password protection)
- **Email Templates:** re-upload custom templates if any

### 4.4 Regenerate TypeScript types
```bash
bash scripts/migration/06_gen_types.sh <NEW_REF>
git add src/integrations/supabase/types.ts && git commit -m "chore: regen types for new project"
```

---

## Phase 5 — Frontend on Vercel (~1 hour)

1. https://vercel.com → **Add New → Project → Import** your GitHub repo
2. Framework: **Vite** (auto-detected)
3. Build command: `npm run build` · Output dir: `dist`
4. **Environment Variables** (Production + Preview + Development):
   ```
   VITE_SUPABASE_URL=https://<NEW_REF>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<new anon key>
   VITE_SUPABASE_PROJECT_ID=<NEW_REF>
   ```
5. Deploy → smoke-test on `<project>.vercel.app`
6. **Lower DNS TTL to 300s** at your DNS provider 24h before cutover
7. **Settings → Domains** → add your custom domain → follow DNS instructions
8. `vercel.json` is already in the repo (SPA rewrites + asset caching) — nothing to add

---

## Phase 6 — Cut Over Webhooks (~30 min, coordinated)

**Run during a low-traffic window.**

### 6.1 Paystack
Dashboard → **Settings → API Keys & Webhooks → Webhook URL:**
```
https://<NEW_REF>.supabase.co/functions/v1/paystack-webhook
```

### 6.2 Wema (when live)
Account officer portal → Webhook URL:
```
https://<NEW_REF>.supabase.co/functions/v1/wema-webhook
```
If Wema enforces IP allowlisting on **your** outbound IP, configure a NAT
proxy (see Security Posture Assessment, P0 #4) and share its static IP with
Wema **before** cutover.

### 6.3 Send test webhooks from each provider
```bash
bash scripts/migration/07_smoke_test.sh https://<NEW_REF>.supabase.co
psql "$NEW_DIRECT_URL" -c "SELECT created_at, provider, event_type, processed FROM webhook_events ORDER BY created_at DESC LIMIT 5"
```

---

## Phase 7 — Verification & Decommission

### 7.1 End-to-end smoke test on production
- Sign up a new test user → confirm via email
- Login → confirm dashboard loads
- As admin: create a student → confirm DVA is auto-created
- Run payment simulator → confirm transaction + wallet credit
- Run reconciliation → confirm log entry
- View audit log → confirm entries are written

### 7.2 Monitor for 48h
Both backends remain warm. If anything breaks → **Rollback** (next section).

### 7.3 After 7 clean days
- Disable Lovable Cloud project (Lovable → Connectors → Lovable Cloud)
- Optionally disconnect Lovable GitHub App if you don't want auto-sync
- Archive `.lovable/` and `supabase/config.toml` `project_id` is now yours

---

## Rollback Plan

If anything fails in the 48h window after cutover:

1. **Paystack + Wema:** revert webhook URLs to the Lovable Cloud endpoints
2. **Vercel:** revert env vars to old project (or redeploy the previous Lovable preview)
3. Lovable Cloud is untouched — instant fallback

---

## What Stops Working (and what to use instead)

| Lovable feature | Replacement |
|---|---|
| Lovable AI editor | Cursor / VS Code + GitHub Copilot |
| Lovable Cloud Secrets UI | Supabase Dashboard → Project Settings → Vault |
| Auto-regenerated `types.ts` | `scripts/migration/06_gen_types.sh` after each migration |
| One-click Publish | `git push` → Vercel auto-deploy |
| Preview URLs | Vercel preview deployments per branch |
| Console / logs panel | Supabase Dashboard → Logs + Vercel Logs + Sentry (optional) |

---

## What Keeps Working Unchanged

- All React/Vite code, Tailwind, shadcn components, routing
- All RLS policies, DB triggers, edge function code
- Paystack inline checkout, Wema webhook flow, audit logs, reconciliation
- Existing user passwords (bcrypt hashes migrate intact)

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Password hashes don't migrate | Test with 1 user first; use full `pg_dump` of `auth.users` |
| Webhook gap during cutover | Schedule low-traffic window; Paystack retries 72h automatically |
| Static IP mismatch breaks Wema | Stand up NAT proxy + register IP with Wema before cutover |
| Sequences reset to 1 | Step 3.3 `setval()` commands above |
| Google OAuth redirect mismatch | Update authorised redirect URIs in Google Cloud Console |
| Service-role key leaked during migration | Never commit secrets; use env vars only; rotate after migration |

---

## Estimated Effort

- Solo engineer with Supabase experience: **2–3 working days**
- Calendar time recommended: **1 week** (includes 48h dual-run window)

---

## Helper Scripts (in `scripts/migration/`)

| Script | Purpose |
|---|---|
| `01_export_schema.sh` | Dump schema-only SQL from Lovable Cloud |
| `02_export_data.sh` | Dump `auth.users` + `public.*` data |
| `03_restore_to_new.sh` | Restore into new Supabase project |
| `04_deploy_functions.sh` | `supabase functions deploy` all 9 functions |
| `05_set_secrets.sh` | Template: `supabase secrets set` for all runtime secrets |
| `06_gen_types.sh` | Regenerate `src/integrations/supabase/types.ts` |
| `07_smoke_test.sh` | Curl the deployed function endpoints for a quick health check |

All scripts assume you've already run `supabase login` and `supabase link`.

---

## Post-Migration Hardening (recommended next steps)

See `/mnt/documents/wema_security_posture_assessment.pdf` for the full P0–P3
remediation list. Top 4 to action **before** going live with Wema:
1. Administrator MFA (Supabase TOTP, AAL2 enforcement)
2. Leaked-password check (HIBP) — already covered in Phase 4.3
3. Server-side rate limiting on edge functions
4. Static outbound IP / NAT proxy for Wema's allowlist

---

_Last updated: 2026-05-18. Maintained alongside the codebase._
