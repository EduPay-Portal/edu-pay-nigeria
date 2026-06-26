## Goal
Give you full ownership of your backend by moving from Lovable Cloud to your own Supabase project — no Lovable dependency for database, auth, or edge functions.

Good news: your repo already contains a complete migration runbook (`MIGRATION.md`) and 7 helper scripts in `scripts/migration/`. This plan wraps them in a friendly, kid-simple guide and adds a one-page checklist so you can actually do the move.

## What you'll own after migration
- Your own Supabase project (database, auth, edge functions, secrets) — billed directly to you, not via Lovable
- GitHub repo (already yours)
- Vercel deployment (already yours)
- Paystack + Wema webhooks pointing at your new Supabase

Lovable becomes optional — only useful if you still want the AI editor.

## Deliverables (docs only — no code or backend changes yet)

### 1. New friendly guide: `OWN_YOUR_BACKEND.md` (repo root)
Written at the same 9-year-old level as `HOW_IT_WORKS.md`. Sections:
- "Why move?" — what changes, what stays the same
- "The 3 houses your app lives in today" vs "after migration" (diagram)
- 7-phase checklist with checkboxes (mirrors `MIGRATION.md` phases 0–7)
- "What you need before starting" (accounts, CLIs, ~2–3 days of work)
- "The day of the move" — 30-minute webhook cutover window
- "If something breaks" — rollback in 3 steps
- "After 7 clean days" — how to safely turn off Lovable Cloud
- Embedded Mermaid diagram of the new architecture

### 2. New rendered diagram: `/mnt/documents/Own_Your_Backend.mmd`
Mermaid flowchart showing the target architecture (GitHub → Vercel → Your Supabase; Paystack/Wema → Your Supabase webhooks). Shareable artifact.

### 3. Light touch-ups to existing docs
- `HOW_IT_WORKS.md` — add a one-line pointer at the bottom: "Want to own everything yourself? See `OWN_YOUR_BACKEND.md`."
- `MIGRATION.md` — leave as-is (it's already the authoritative technical runbook). The new guide links into it for each phase.

## Out of scope (this plan does NOT do)
- Does NOT create a new Supabase project for you (you do that during execution)
- Does NOT touch the database, edge functions, secrets, RLS, or auth config
- Does NOT change `.env`, `supabase/config.toml`, or any source code
- Does NOT disconnect Lovable Cloud (that's a deliberate step you take after the 7-day dual-run)
- Does NOT modify Vercel or GitHub settings

## Files to touch
- `OWN_YOUR_BACKEND.md` (new, repo root)
- `/mnt/documents/Own_Your_Backend.mmd` (new, rendered artifact)
- `HOW_IT_WORKS.md` (1-line addition at the bottom)

## When you're ready to actually run the migration
Approve this plan first → I write the guide. Then, when you're ready to execute, you run the scripts in `scripts/migration/` from your local machine following the new guide + `MIGRATION.md`. Estimated effort: 2–3 working days, 1 calendar week recommended (includes 48h safety window).
