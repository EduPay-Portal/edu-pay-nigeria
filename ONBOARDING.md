# EduPay Connect — Developer Onboarding & Product Document

> **DEPRECATION NOTICE (2026):** Paystack integration has been deprecated; **Wema Bank DVA is the sole payment provider**. Any Paystack references below are retained as historical context only — do not implement new Paystack code paths. See `WEMA_INTEGRATION.md` for the current architecture.

> A single source of truth for new engineers joining the EduPay Connect project.
> Read this top-to-bottom on Day 1. Bookmark sections you'll come back to.



---

## Table of Contents

1. [Project Overview (Executive Summary)](#1-project-overview-executive-summary)
2. [Current Progress](#2-current-progress)
3. [Remaining Work (Phased & Prioritized)](#3-remaining-work-phased--prioritized)
4. [Blockers & Risks](#4-blockers--risks)
5. [Technical Architecture Overview](#5-technical-architecture-overview)
6. [Product Requirements Document (PRD)](#6-product-requirements-document-prd)
7. [Developer Onboarding Guide](#7-developer-onboarding-guide)
8. [Appendix: Useful Links](#8-appendix-useful-links)

---

## 1. Project Overview (Executive Summary)

### Purpose

**EduPay Connect** is a school fee collection platform for Nigerian schools. It eliminates the manual, error-prone reconciliation process that schools traditionally face when collecting fees through shared bank accounts.

Every student receives a **permanent, dedicated virtual bank account number (DVA)** issued through Paystack and settled by **WEMA Bank**. Any payment made into that account number is automatically attributed to the correct student, recorded as a transaction, and credited to the student's in-app wallet — with zero manual intervention from school staff.

### Core Functionality

- **Per-Student Virtual Accounts** — every student is provisioned a unique 10-digit NUBAN account
- **Automated Payment Capture** — Paystack webhook updates wallet balance in real time
- **Multi-Role Dashboards** — Students, Parents, and Admins see views tailored to their needs
- **Reconciliation Tools** — Admins can audit webhook events and re-process failed payments
- **Bulk Onboarding** — CSV import to create hundreds of students and provision DVAs in one operation

### Core Payment Flow

```
Parent / Sponsor                Paystack                  Settlement
      |                            |                          |
      |  bank transfer to DVA      |                          |
      |--------------------------->|                          |
      |                            |  funds settled to        |
      |                            |  school WEMA account     |
      |                            |------------------------->|
      |                            |                          |
      |                            |  webhook: charge.success |
      |                            |--------------+           |
      |                                           v           |
      |                                   Supabase Edge Fn    |
      |                                   - verify HMAC       |
      |                                   - find student      |
      |                                   - create txn        |
      |                                   - credit wallet     |
      |                                                       |
      |                Student / Parent dashboard updates live
```

### Goal & Expected Impact

| Metric | Before EduPay | With EduPay |
|---|---|---|
| Time to reconcile a payment | Hours / days | Seconds (automatic) |
| Misattributed payments | Common | ~0 (unique DVA per student) |
| Visibility for parents | Manual receipts | Real-time dashboard |
| Staff hours / month on collections | High | Minimal — exception handling only |

---

## 2. Current Progress

The project is approximately **75% complete** (Phase 3 of 5).

### 2.1 Authentication & Authorization
- Supabase Auth with **PKCE** flow
- Three roles: `student`, `parent`, `admin` — stored in a separate `user_roles` table (no role on profile to prevent privilege escalation)
- `has_role()` `SECURITY DEFINER` function used in RLS policies
- Role-based routing via `ProtectedRoute.tsx` and `useUserRole` hook
- 24-hour idle session timeout (`src/integrations/supabase/client.ts`)

### 2.2 Database (10 migrations applied)

| Table | Purpose |
|---|---|
| `profiles` | Common user profile fields |
| `student_profiles` | Admission number, class, section, parent link, debt balance |
| `parent_profiles` | Occupation, notification preference, emergency contact |
| `admin_profiles` | Department, access level |
| `user_roles` | Source of truth for roles (RLS-safe) |
| `wallets` | Per-user balance, currency |
| `transactions` | Credit/debit ledger with Paystack reference |
| `virtual_accounts` | Student-to-DVA mapping (account number, bank, customer code) |
| `paystack_webhook_events` | Audit log of every webhook received |
| `bulk_import_*` | Staging tables for CSV onboarding |

All tables are protected by **Row-Level Security**.

### 2.3 Edge Functions (Supabase)

| Function | Purpose |
|---|---|
| `create-virtual-account` | Creates Paystack customer + assigns DVA |
| `bulk-create-virtual-accounts` | Batch DVA provisioning |
| `bulk-create-students` | Batch student profile creation from CSV |
| `paystack-webhook` | HMAC-verified webhook receiver, kobo→naira conversion, wallet credit |
| `simulate-payment` | Admin-only payment simulator for testing |

### 2.4 Frontend

- **Student Dashboard** — VA card, wallet balance, transaction table
- **Parent Dashboard** — child VA card, top-up dialog, transaction history
- **Admin Dashboard** — revenue chart, top students chart, transaction pie, quick stats
- **Admin tools** — Students page, Parents page, Bulk Import, Reconciliation, Webhooks monitor, Payment Simulator, Settings
- **shadcn/ui** components throughout, **Tailwind** with semantic HSL tokens
- Brand color: deep navy `#0d4a6b`, EduPay logo applied
- React Router v6, React Query, Zod form validation, sonner toasts

### 2.5 Security Hardening

- HMAC-SHA512 webhook signature verification
- Idempotency on `paystack_reference` (no duplicate credits)
- RLS policies on every table
- Roles in dedicated table (no client-side admin checks)
- Input sanitization (`src/lib/security/sanitize.ts`)
- Client-side rate limiting (`src/lib/rateLimit.ts`)
- Zod schemas for auth, financial, and profile inputs
- `.env` validated at boot via `src/lib/env.ts`

### 2.6 Documentation Already in Repo

- `README.md` — quick start
- `SUPABASE_SETUP.md` — DB provisioning steps
- `PAYSTACK_SETUP.md` — Paystack integration walkthrough
- `database_setup.sql` — full schema baseline
- `migrations/*.sql` — incremental migrations

---

## 3. Remaining Work (Phased & Prioritized)

### P0 — Blockers (must resolve before launch)

| # | Task | Owner | Notes |
|---|---|---|---|
| P0-1 | Activate Paystack DVA feature on production account | Business / PM | Requires email to Paystack support; can take days |
| P0-2 | Resolve Supabase "Failed to fetch" sign-in error | Backend | Check project pause / API URL / CORS |
| P0-3 | End-to-end live payment test (real ₦100 transfer → DVA → wallet credit) | QA | Confirms full pipeline |

### P1 — Backend (core business logic)

- **Fee allocation engine** — when a webhook credits a wallet, automatically deduct outstanding fees and reduce `student_profiles.debt_balance`
- **Fee schedule tables** — `fee_schedules` (term, class_level, amount), `student_fee_assignments`
- **Receipt generator** — server-side PDF on successful payment
- **Refund processing** edge function

### P1 — Frontend

- Admin **Fee Schedule Management** page (CRUD by term/class)
- **Receipt download** button on completed transactions
- **Notification preferences** UI on parent profile
- Per-student fee statement view

### P2 — DevOps

- Vercel production deployment with custom domain
- Upgrade Supabase to **Pro** tier (no auto-pause, daily backups)
- Sentry / LogRocket for error monitoring
- GitHub Actions: lint, typecheck, build on PR
- Database backup verification runbook

### P2 — Notifications

- Email via Resend (payment received, low balance, fee due)
- SMS via Termii or similar (Nigeria-friendly)
- Per-user opt-in preferences honored

### P3 — Testing

- Vitest unit tests for hooks, validators, sanitizers
- Playwright E2E: sign-up → DVA provisioned → simulated payment → wallet updated
- Webhook contract test (replay recorded Paystack payloads)

### P3 — Polish & Future

- Payment analytics dashboard (cohort, channel, time-of-day)
- Multi-bank DVA support (Zenith, GTBank, UBA fallback)
- Automated fee reminders (cron via Supabase scheduled functions)
- Mobile PWA install prompt

---

## 4. Blockers & Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R-1 | Paystack DVA feature not yet enabled on live account | Cannot launch | High | Email Paystack support immediately; have Compliance docs ready (CAC, school registration) |
| R-2 | Supabase Free tier auto-pauses after inactivity | Sign-in fails, webhook drops | Medium | Upgrade to Pro before launch ($25/mo) |
| R-3 | Webhook delivery failure (network, downtime) | Payment not reflected | Medium | Paystack auto-retries; build admin "Reconcile by reference" tool (partially done in `ReconciliationPage`) |
| R-4 | NDPR / data privacy compliance (Nigerian law) | Legal exposure | Medium | Add privacy policy, encrypt PII at rest, document data retention; appoint DPO |
| R-5 | Single bank dependency (WEMA only) | If WEMA has outage, all payments fail | Low–Med | Add fallback bank in DVA creation; show user a backup transfer option |
| R-6 | Paystack fee changes erode margin | Operational | Low | Track fees per transaction in `transactions.metadata` for analysis |
| R-7 | Bulk import errors corrupt student data | Data integrity | Medium | Staging table pattern already in place; require admin "Confirm" step before commit |
| R-8 | Hard-coded anon key in `src/lib/env.ts` defaults | Disclosure (low — anon key is safe by design) | Low | Acceptable per Supabase guidance; document clearly |

---

## 5. Technical Architecture Overview

### 5.1 High-Level System Diagram

```
+-----------------------------+        +------------------------------+
|   Browser (React + Vite)    |        |        Paystack API          |
|                             |        |                              |
|  - shadcn/ui components     |        |  - Customer create           |
|  - React Router v6          |        |  - Dedicated Virtual Account |
|  - React Query              |        |  - Webhooks (charge.success) |
|  - Tailwind (HSL tokens)    |        +---------------+--------------+
+--------------+--------------+                        |
               |                                       | webhook
               | HTTPS                                 v
               v                          +------------+--------------+
+----------------------------------+      |   Supabase Edge Function  |
|         Supabase Cloud           |      |     paystack-webhook      |
|                                  |      |   (HMAC-SHA512 verify)    |
|  +----------------------------+  |      +------------+--------------+
|  |     Auth (PKCE flow)       |  |                   |
|  +----------------------------+  | <-----------------+
|  +----------------------------+  |
|  |  Postgres + RLS            |  |
|  |  - profiles                |  |      +---------------------------+
|  |  - wallets                 |  |      |   WEMA Bank (settlement)  |
|  |  - transactions            |  |<-----|   pays out to school      |
|  |  - virtual_accounts        |  |      +---------------------------+
|  |  - paystack_webhook_events |  |
|  +----------------------------+  |
|  +----------------------------+  |
|  |   Edge Functions (Deno)    |  |
|  |  - create-virtual-account  |  |
|  |  - bulk-create-*           |  |
|  |  - paystack-webhook        |  |
|  |  - simulate-payment        |  |
|  +----------------------------+  |
+----------------------------------+
```

### 5.2 Webhook Flow (Detailed)

```
1. Parent transfers ₦50,000 to DVA 8020151234
2. Paystack receives funds, fires webhook to /functions/v1/paystack-webhook
3. Edge function:
     a. Reads x-paystack-signature header
     b. Computes HMAC-SHA512 of body using PAYSTACK_WEBHOOK_SECRET
     c. Constant-time compare; reject if mismatch (logged in webhook_events)
     d. Parses event; if event.type == 'charge.success':
          - look up virtual_accounts by account_number
          - check transactions.paystack_reference for idempotency
          - INSERT transaction (type=credit, status=completed)
          - UPDATE wallet balance (+amount in naira)
          - UPDATE virtual_accounts.total_received, last_payment_at
          - INSERT paystack_webhook_events (processed=true)
4. Frontend (React Query) refetches; UI updates live
```

### 5.3 Key Tables (Relationships)

```
auth.users (Supabase) 1───1 profiles
                      │
                      ├──1 user_roles (1..N)
                      ├──1 student_profiles ──N parent (FK to user)
                      ├──1 parent_profiles
                      ├──1 admin_profiles
                      ├──1 wallets ──N transactions
                      └──1 virtual_accounts (for students)
```

### 5.4 Component Map

| Page | Hooks | Edge Function |
|---|---|---|
| `StudentDashboard` | `useVirtualAccount`, `useUserRole` | — |
| `ParentDashboard` | `useVirtualAccount`, `usePaystackPayment` | — |
| `AdminDashboard` | `useUserRole` | — |
| `BulkImportPage` | `useBulkCreateVirtualAccounts` | `bulk-create-students`, `bulk-create-virtual-accounts` |
| `PaymentSimulatorPage` | — | `simulate-payment` |
| `ReconciliationPage` | — | (reads `paystack_webhook_events`) |
| `WebhooksPage` | — | (reads `paystack_webhook_events`) |
| Add Student dialog | `useCreateVirtualAccount` | `create-virtual-account` |

---

## 6. Product Requirements Document (PRD)

### 6.1 Problem Statement

Nigerian schools collect fees through a single shared bank account. Parents are required to write the student's name on a teller, send proof of payment via WhatsApp, and wait days for the bursar to manually match payments. This causes:
- Misattributed or "lost" payments
- Disputes between parents and the school
- Hours of weekly reconciliation work
- No real-time visibility into outstanding balances

### 6.2 Objectives

1. Issue a unique, permanent bank account number to every student.
2. Auto-credit and auto-attribute every incoming payment.
3. Give parents and admins real-time payment visibility.
4. Reduce manual reconciliation effort by **>90%**.

### 6.3 Success Metrics

| Metric | Target |
|---|---|
| Webhook processing success rate | ≥ 99.5% |
| Time from payment to wallet credit | < 30 seconds |
| Reduction in admin reconciliation time | > 90% |
| Parent payment satisfaction (NPS) | ≥ 50 |

### 6.4 User Roles & Permissions Matrix

| Capability | Student | Parent | Admin |
|---|:-:|:-:|:-:|
| View own VA | ✓ | ✓ (child's) | ✓ (all) |
| View own transactions | ✓ | ✓ | ✓ (all) |
| Top up wallet | ✓ | ✓ | — |
| Create student | — | — | ✓ |
| Bulk import students | — | — | ✓ |
| Provision VA | — | — | ✓ |
| View webhook events | — | — | ✓ |
| Simulate payments | — | — | ✓ |
| Manage fee schedule | — | — | ✓ (planned) |

### 6.5 Key Features

| Feature | Acceptance Criteria |
|---|---|
| VA Generation | Every student record creation triggers DVA provisioning; failures logged + retryable |
| Payment Capture | `charge.success` webhook → wallet credited within 30s; idempotent |
| Reconciliation | Admin can search by reference, replay, see signature validity |
| Bulk Import | CSV upload → staging → admin confirms → batch insert + provision |
| Receipts | Every completed credit transaction generates downloadable receipt (planned) |
| Fee Allocation | Auto-debit fees on credit; reduce `debt_balance` (planned) |

### 6.6 User Flows

**Parent payment**
1. Parent logs in → views child VA card
2. Copies account number
3. Initiates bank transfer from their banking app
4. Receives push/email confirmation within seconds
5. Sees updated wallet balance and new transaction row

**Admin onboarding a class**
1. Admin downloads CSV template
2. Fills student data, uploads on Bulk Import page
3. Reviews staging preview, clicks "Confirm Import"
4. System creates students + DVAs in batches
5. Admin downloads "DVA assignment" report to share with parents

**Reconciliation (exception path)**
1. Parent claims payment not reflected
2. Admin opens Reconciliation page → searches by reference
3. Inspects webhook event row (signature_valid, processed, error_message)
4. Hits "Reprocess" if failed; or contacts Paystack if no event received

### 6.7 Functional Requirements (extract)

- **FR-1**: Every `student_profiles` row must have at most one active `virtual_accounts` row.
- **FR-2**: `paystack-webhook` MUST reject any request whose HMAC does not match.
- **FR-3**: Duplicate webhook for same `paystack_reference` MUST NOT credit twice.
- **FR-4**: Wallet balance is the sum of completed transactions for that wallet (invariant).
- **FR-5**: Only users with `admin` role in `user_roles` may invoke admin edge functions.
- **FR-6**: All amounts stored in NGN (naira) at rest; conversion from kobo happens in webhook.

### 6.8 Non-Functional Requirements

| Category | Requirement |
|---|---|
| Security | RLS on every table; HMAC verification; PKCE auth; secrets in Supabase Vault |
| Scalability | Support 10,000 students and 50,000 transactions/month on Supabase Pro |
| Reliability | 99.5% uptime target; webhook retries handled by Paystack |
| Performance | Dashboard FCP < 2s on 3G; webhook handler P95 < 500ms |
| Compliance | NDPR-aligned: privacy policy, data export, deletion request flow |
| Observability | All edge functions log structured JSON; webhook events fully audited |

---

## 7. Developer Onboarding Guide

### 7.1 Prerequisites

- **Node.js** ≥ 18 (project uses Vite 5)
- **bun** (preferred) or **npm**
- **Supabase CLI** (for migrations and edge function deploys)
- A **Paystack test account** (https://dashboard.paystack.com)
- VS Code with `dbaeumer.vscode-eslint` and `bradlc.vscode-tailwindcss`

### 7.2 Local Setup

```bash
# 1. Install
bun install

# 2. Environment
cp .env.example .env
# Fill in:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_ANON_KEY
#   VITE_PAYSTACK_PUBLIC_KEY (test key)

# 3. Run
bun run dev
# App on http://localhost:5173
```

For backend changes, see `SUPABASE_SETUP.md` for migration steps and `PAYSTACK_SETUP.md` for webhook configuration.

### 7.3 Repository Tour

```
src/
  pages/                      # Route components
    Auth.tsx                  # Sign-in / sign-up
    dashboard/
      StudentDashboard.tsx
      ParentDashboard.tsx
      AdminDashboard.tsx
      admin/                  # Admin-only pages
  components/
    dashboard/                # Shared dashboard widgets
    admin/                    # Admin-specific components
    ui/                       # shadcn primitives — DO NOT edit
  hooks/                      # React Query + custom hooks
    useVirtualAccount.ts      # Student VA fetcher
    useCreateVirtualAccount.ts
    useBulkCreateVirtualAccounts.ts
    usePaystackPayment.ts     # Inline card top-up
    useUserRole.ts            # Role gating
  contexts/
    AuthContext.tsx           # Session + user state
  lib/
    env.ts                    # Validated env vars (Zod)
    logger.ts
    rateLimit.ts
    security/sanitize.ts
    validations/              # Zod schemas (auth, financial, profiles)
  integrations/
    supabase/client.ts        # Supabase singleton + idle timeout
  types/
    auth.ts
    wallet.ts

supabase/
  config.toml                 # verify_jwt = false for paystack-webhook
  functions/
    paystack-webhook/         # MOST CRITICAL — read this first
    create-virtual-account/
    bulk-create-students/
    bulk-create-virtual-accounts/
    simulate-payment/

migrations/                   # Run in order via Supabase SQL editor
```

### 7.4 Coding Conventions

- **TypeScript strict** — no `any` unless justified with a comment
- **Tailwind semantic tokens only** — never `text-white` / `bg-black`; use `text-foreground`, `bg-background`, etc. Defined in `src/index.css` and `tailwind.config.ts`. All colors HSL.
- **shadcn/ui** for primitives; build feature components on top
- **Zod** for every form and edge function input
- **RLS-first** — assume the client is hostile; never trust role checks done in the browser
- **Roles** live in `user_roles` only — never on `profiles`
- **React Query** for all server state; avoid `useEffect` data fetching
- **Toasts** via `sonner` for user feedback
- **Logging** via `src/lib/logger.ts` (do not `console.log` in production paths)

### 7.5 First-Week Plan

| Day | Goal | Deliverable |
|---|---|---|
| **1** | Environment up, read this doc + `PAYSTACK_SETUP.md` + `SUPABASE_SETUP.md` | Local app runs; can sign up as student |
| **2** | Trace one payment end-to-end: read `simulate-payment` → `paystack-webhook` → `useVirtualAccount` | Whiteboard / writeup of the flow shared with team |
| **3** | Ship a small, low-risk fix (e.g., copy tweak, empty state, accessibility label) | Merged PR; pipeline green |
| **4** | Spike on **Fee Allocation MVP** (P1-1): design schema + write the deduction logic in webhook | Draft migration + updated `paystack-webhook` behind a feature flag |
| **5** | Code review, write a Vitest test for the new logic, demo at standup | PR ready for merge; doc updated |

### 7.6 What to Avoid

- Editing files in `src/components/ui/` (shadcn primitives) directly
- Hardcoding colors in components
- Storing roles on `profiles` or in `localStorage`
- Calling Paystack from the browser (always go through an edge function)
- Disabling RLS to "make it work" — fix the policy instead
- Committing secrets — use Supabase Vault / Lovable Secrets

---

## 8. Appendix: Useful Links

- Project preview: https://id-preview--114f0f87-478b-4c85-9b56-a83463541eed.lovable.app
- Published app: https://edu-pay-nigeria.lovable.app
- Supabase project: https://fmajhzepqpnrzbtcdiix.supabase.co
- Paystack API docs: https://paystack.com/docs/api
- Paystack DVA guide: https://paystack.com/docs/payments/dedicated-virtual-accounts
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- shadcn/ui: https://ui.shadcn.com
- Tailwind CSS: https://tailwindcss.com/docs
- React Query: https://tanstack.com/query/latest
- Zod: https://zod.dev
- NDPR overview: https://nitda.gov.ng/nigeria-data-protection-regulation/

---

**Document version:** 1.0
**Last updated:** 2026-04-19
**Maintainer:** Engineering team — keep this file current as Phase 4/5 features land.
