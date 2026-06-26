## What I'll do

Three small, independent deliverables — no app behavior changes.

### 1. Save a rendered flow diagram
- Write `/mnt/documents/App_Update_Flow.mmd` with the Mermaid diagram from the chat (You → Lovable → Preview / GitHub → Vercel → Live Site, with Lovable Cloud branch for backend).
- Surface it as a `<lov-artifact>` so you can open, zoom, and share it.

### 2. Check your GitHub + Vercel setup
- Read `vercel.json` and `package.json` and confirm:
  - SPA fallback rewrite to `/` is present (so deep links don't 404 on refresh).
  - Long-term cache headers on `/assets/*`.
  - Build command + output directory match Vite defaults (`npm run build` → `dist`).
  - `VITE_` prefixed env vars are the only ones the client needs.
- Report findings in chat. If anything is missing or wrong, I'll fix `vercel.json` in the same turn.
- I will NOT touch GitHub remotes, Vercel project settings, or any secret — those live outside the repo.

### 3. Add `HOW_IT_WORKS.md` to the repo
A friendly, 9-year-old-level guide at the project root. Sections:
- **The 3 places your app lives** (Lovable, GitHub, Vercel) + Lovable Cloud as the backend helper.
- **What happens when you ask for a change** (numbered 1–5 flow).
- **Frontend vs Backend** — which changes go through Vercel and which deploy instantly.
- **What you should do as the boss** — wait ~2 min after publish, don't paste secrets in chat, etc.
- **Flow diagram** — embedded Mermaid block (GitHub renders it natively) plus an ASCII fallback.
- **Troubleshooting quick table** — "live site looks old" → wait for Vercel; "login broken" → check Lovable Cloud; "404 on refresh" → SPA rewrite.

### Out of scope
- No code, UI, database, or auth changes.
- No publishing or deploying.
- No edits to `.env`, Supabase config, or GitHub/Vercel dashboards.

### Files touched
- `/mnt/documents/App_Update_Flow.mmd` (new, user-visible artifact)
- `vercel.json` (only if the audit finds a gap)
- `HOW_IT_WORKS.md` (new, repo root)
