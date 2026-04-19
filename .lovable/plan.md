
## Plan: Add Comprehensive Onboarding Document to Repo

Create a single, well-structured markdown file at the project root that a new developer can open and immediately ramp up from.

### File to create

**`ONBOARDING.md`** — comprehensive onboarding guide (root of repo, alongside `README.md` and `PAYSTACK_SETUP.md`).

### Document structure

The file will contain these sections, written in a clear, professional, scannable style with tables, code blocks, and ASCII diagrams where helpful:

1. **Project Overview (Executive Summary)**
   - Purpose: automate school fee collection via per-student dedicated virtual accounts (DVAs)
   - Core flow: Student → DVA → Paystack → WEMA Bank settlement → wallet credit
   - Goal & impact: eliminate manual reconciliation, give every student a permanent payment identity

2. **Current Progress (~75% complete)**
   - Auth (Supabase, PKCE, 3 roles), profiles, role tables
   - Database: 10 migrations, wallets, transactions, virtual_accounts, webhook events
   - Edge Functions: `create-virtual-account`, `bulk-create-virtual-accounts`, `bulk-create-students`, `paystack-webhook`, `simulate-payment`
   - Frontend: Student/Parent/Admin dashboards, VA card, transactions, bulk import, reconciliation, webhook monitoring, payment simulator
   - Branding: deep navy (#0d4a6b) + EduPay logo applied
   - Security: HMAC-SHA512 webhook verification, RLS, role table, rate limiting, input sanitization

3. **Remaining Work (phased & prioritized)**
   - **P0 Blockers:** Paystack DVA activation, fix Supabase "Failed to fetch", end-to-end live test
   - **P1 Backend:** fee allocation logic, auto debt_balance reduction, payment receipts, fee schedule tables
   - **P1 Frontend:** fee schedule admin UI, receipt download, notification preferences
   - **P2 DevOps:** Vercel + Supabase Pro deployment, monitoring, backups, custom domain
   - **P2 Notifications:** email (Resend) + SMS for payment confirmations
   - **P3 Testing:** unit (Vitest), E2E (Playwright), webhook contract tests
   - **P3 Polish:** PDF receipts, analytics, refund flow

4. **Blockers & Risks** — table format with: Risk | Impact | Mitigation
   - Paystack DVA not activated (critical)
   - Supabase free-tier auto-pause
   - Webhook delivery failures
   - PCI/data compliance (NDPR)
   - Single bank dependency (WEMA)

5. **Technical Architecture Overview**
   - ASCII diagram of: React/Vite frontend → Supabase (Auth, Postgres, Edge Functions) → Paystack API → WEMA Bank
   - Webhook flow diagram
   - Key tables and their relationships
   - Component map (which page uses which hook/function)

6. **Product Requirements Document (PRD)**
   - Problem statement, objectives, success metrics
   - User roles & permissions matrix
   - Feature list with acceptance criteria
   - User flows (student payment, admin onboarding, reconciliation)
   - Functional requirements (FR-1…FR-N)
   - Non-functional: security, scalability (1000+ students), reliability, performance, NDPR compliance

7. **Developer Onboarding Guide**
   - Prerequisites (Node 18+, bun/npm, Supabase CLI, Paystack test account)
   - Local setup steps (clone, install, `.env` from `.env.example`, run migrations, `npm run dev`)
   - Repository tour: key directories and files annotated
   - Coding conventions (TS, Tailwind, shadcn, Zod validation, RLS-first thinking)
   - **First-week plan** (Day 1: env + read codebase; Day 2: trace a payment end-to-end; Day 3: ship a small fix; Day 4: build fee allocation MVP; Day 5: review + PR)
   - Useful links (Supabase dashboard, Paystack docs, existing setup guides)

### Approach

- Pure documentation task — single file, no code changes, no dependencies
- Will reference existing files (`PAYSTACK_SETUP.md`, `SUPABASE_SETUP.md`, `database_setup.sql`, migrations) so the doc complements rather than duplicates them
- Length target: ~600–900 lines — thorough but skimmable via a top-of-file table of contents
- No emojis, professional tone, tables for matrices, fenced code blocks for commands, ASCII for diagrams

### Out of scope

- No code edits, no new dependencies, no UI changes
- Not generating PDF/Word (per your choice)
- Not modifying `README.md` (will suggest linking to ONBOARDING.md from it as a follow-up if you want)
