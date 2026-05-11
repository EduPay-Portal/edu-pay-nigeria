
# Wema Bank — Security & Architecture Posture Assessment

You asked for an honest, consultant-grade review of whether this platform meets the bar a Tier-1 Nigerian bank will set before granting direct Virtual NUBAN Collections API access. Below is the proposed deliverable plus a preview of the verdict so you can decide before I generate the document.

## Deliverable

A professional assessment pack written **for the Wema risk/integration team** (not internal devs):

1. **`wema_security_posture_assessment.pdf`** (8–10 pages, navy-themed, matches the letter + architecture diagram already produced)
2. **`wema_security_posture_assessment.docx`** (editable copy you can sign and submit)
3. **`wema_remediation_roadmap.pdf`** (1-page priority matrix: P0 → P3 with effort/impact)

All three saved to `/mnt/documents/` and previewed as `presentation-artifact` tags.

## Document Structure

```text
1. Executive Summary
   - One-paragraph verdict + readiness score (X / 100)
   - Color-coded traffic light per risk domain
2. Platform Overview
   - What the system does, transaction flow, who uses it
3. Current Security Posture (mapped to Wema's 10 concerns)
   For each domain: What we HAVE  |  What's MISSING  |  Risk rating
4. Gap Analysis & Remediation Roadmap
   - P0 (block go-live) / P1 (before pilot) / P2 (before scale) / P3 (continuous)
5. Compliance & Operational Readiness
   - Documents we have / need (CAC, privacy policy, DR plan, IR plan…)
6. Appendices
   - A. Architecture diagram (reuse the one already produced)
   - B. Webhook security spec (HMAC-SHA512 + IP allowlist + idempotency — already implemented)
   - C. RLS & role model summary
   - D. Incident response runbook skeleton
```

## Honest Verdict (preview — full version goes in the doc)

Based on reading the codebase (`supabase/functions/wema-webhook`, `_shared/payments/*`, `AuthContext`, `rateLimit`, RLS pattern, audit_logs table, migrations 002 & 011):

### Where we ALREADY meet the bar (be proud of these)

| Wema concern | Evidence in code |
|---|---|
| Webhook spoofing | HMAC-SHA512 verify + IP allowlist + `(provider, provider_reference)` unique idempotency index in `wema-webhook/index.ts` |
| Transaction manipulation | Server-side only; wallet credit via DB trigger `apply_transaction_to_wallet`, frontend never trusted |
| Replay / duplicates | `idempotency_key` constraint + `check_transaction_idempotency` trigger |
| Privilege escalation | `user_roles` separate table + `public.has_role()` SECURITY DEFINER; never queried directly in RLS |
| Insider abuse trail | `audit_logs` table + AuditLogPage; `dva.create` and `reconciliation.manual_match` recorded |
| Credential storage | All Wema/Paystack secrets in Lovable Cloud Secrets (never in repo); `.env` only holds public anon key |
| Reconciliation fraud | `reconciliation_logs` (auto/manual/unmatched/over/under/duplicate) + admin reconcile function |
| Negative-balance fraud | `validate_wallet_balance` trigger blocks negative balances |
| Hosting / TLS | Lovable Cloud (Supabase managed Postgres + Deno Deploy edge), HTTPS enforced, DB not publicly exposed |
| Backups | Supabase managed PITR daily backups |

### Where we DO NOT YET meet the bar (honest gaps)

| # | Gap | Severity | Fix |
|---|---|---|---|
| 1 | **No MFA for admin accounts** — Wema will explicitly ask | P0 | Enable Supabase TOTP enrollment + enforce `aal2` for admin role |
| 2 | **No leaked-password (HIBP) check** | P0 | One-toggle: `configure_auth({ password_hibp_enabled: true })` |
| 3 | **Rate limiting is client-side only** (`src/lib/rateLimit.ts` lives in the browser — trivially bypassed) | P0 | Move to edge-function-level limit (Supabase rate-limit headers / Deno KV counter) |
| 4 | **No static outbound IP** — Lovable Cloud edge functions egress from a shared pool, so we cannot give Wema a fixed source IP for their inbound allowlist | P0 | Either (a) front Wema API calls through a small NAT proxy on a dedicated cloud VM with elastic IP, or (b) negotiate signed-request auth in lieu of source-IP allowlist |
| 5 | **No formal pen-test report** | P1 | Engage a CREST/OSCP firm (e.g. Digital Encode, Demeter, Cybervergent) — usually NGN 1.5–4M for a 2-week engagement |
| 6 | **No documented Incident Response / Breach Notification plan** | P1 | Use the IR runbook skeleton in Appendix D |
| 7 | **No separate dev / staging / production projects** — currently one Cloud project | P1 | Spin up a second Lovable project as `staging`, point Wema sandbox creds there; production project gets only live creds |
| 8 | **No anomaly detection** (e.g. sudden spike in failed webhooks, duplicate references, unusual payer banks) | P2 | Daily cron edge function → Slack/email if thresholds breached |
| 9 | **No WAF / DDoS layer in front of edge functions** | P2 | Put Cloudflare in front of the custom domain (proxy mode) |
| 10 | **No data-at-rest encryption beyond Supabase defaults for PII** (BVN, parent phone) | P2 | Column-level `pgcrypto` encryption for `bvn`, `phone` with key in Vault |
| 11 | **No formal data retention / deletion policy** | P2 | Add policy doc + scheduled purge of stale `webhook_events` > 24 months |
| 12 | **Privacy Policy & Terms of Service not in repo** | P1 | Draft, host at `/legal/privacy` and `/legal/terms` |
| 13 | **No uptime monitoring / public status page** | P3 | UptimeRobot or BetterStack pinging `/health` edge function |

### Overall readiness score (preview)

**~68 / 100** — strong on the *technical* fundamentals (webhook security, idempotency, RLS, audit trail), weak on *operational and compliance* posture (MFA, IR plan, pen-test, dev/staging separation, dedicated egress IP). This is **a typical posture for a pre-pilot fintech** and is **fixable in 2–3 weeks** of focused work — no architectural rewrite needed.

## Approach

1. Write the assessment as a `docx` using the `docx` library (same toolchain as the letter), with the navy `#0d4a6b` brand, traffic-light tables, and the appendix diagrams.
2. Convert to PDF via LibreOffice, render every page to JPEG and inspect for layout/overflow issues before delivery.
3. Generate the 1-page roadmap PDF separately (landscape A4, priority matrix table).

## Out of scope

- Actually implementing the 13 fixes (separate follow-up; I'd recommend tackling P0 items #1, #2, #3 in code immediately after this doc — they are 1–2 hour changes each).
- Procurement of pen-test vendor or Cloudflare account (operational, not code).

Reply **"Approved"** to generate the document pack, or tell me which sections to add, drop, or rephrase.
