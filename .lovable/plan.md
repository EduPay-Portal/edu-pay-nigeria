## Goal
Create a one-page technical architecture diagram showing how the school fee collection platform integrates with Wema Bank's Virtual NUBAN Collections API, suitable for sharing with the Wema account officer at the upcoming meeting.

## Format
A single-page **PDF** (landscape A4) generated from a Mermaid diagram, plus the raw `.mmd` source file so it can be edited later. Saved to `/mnt/documents/`:
- `wema_technical_architecture.pdf` — printable handout
- `wema_technical_architecture.mmd` — editable source

## What the diagram will show

Five logical zones, left → right:

1. **Payers** — Parents / guardians initiating bank transfers from any Nigerian bank (GTB, Zenith, UBA, Access, etc.) via mobile app, USSD, or branch.

2. **NIBSS / Inter-bank rails** — NIP transfer routed to Wema Bank.

3. **Wema Bank** 
   - Virtual NUBAN Collections API (per-student permanent NUBAN)
   - Settlement into the school's existing Wema corporate account
   - Outbound webhook (HMAC-SHA512 signed) on every credit

4. **Our Platform (Lovable Cloud / Supabase)**
   - `dva-create` edge function — provisions a Virtual NUBAN per student at onboarding
   - `wema-webhook` edge function — receives & verifies webhook (HMAC + IP allowlist + idempotency)
   - Postgres tables: `virtual_accounts`, `transactions`, `webhook_events`, `wallets`, `reconciliation_logs`, `settlements`
   - Auto-credit student wallet, write audit log, run reconciliation

5. **End users (web app)**
   - Admin dashboard (DVA management, reconciliation, settlements, audit)
   - Parent / Student dashboards (wallet balance, transaction history, receipts)

Arrows will show: money flow (solid), API calls (dashed), webhook callback (bold), and data writes.

A small legend in the corner explains arrow types and a short call-out lists the **5 things we need from Wema** (sandbox creds, production creds, webhook secret, IP allowlist, API docs) so the diagram doubles as a conversation anchor in the meeting.

## Approach
1. Write Mermaid `flowchart LR` source with subgraphs per zone, navy/Wema-purple accent colors.
2. Render to PDF using `mmdc` (mermaid-cli) at landscape A4.
3. QA: convert PDF → JPEG and visually inspect for overflow, clipped text, legibility at print size.
4. Iterate until clean, then deliver both `.pdf` and `.mmd`.