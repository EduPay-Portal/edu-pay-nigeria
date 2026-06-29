## Diagnosis

The same student credentials (`ascistudent@gmail.com` / `DemoStudent123!`) **succeed on the Lovable preview** — auth logs show `status: 200` logins from `id-preview--...lovable.app` minutes ago. There are **zero login attempts in the auth logs originating from `pay.ahmadiyyasciencecollege.ng`**, even though the user just tried.

That means the Vercel site is **not talking to this backend at all**. Its `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` were baked into the Vercel build pointing at a different (older) backend project where this user doesn't exist — so Supabase there returns "Invalid login credentials".

This is purely a Vercel configuration issue, not a code bug. No file changes can fix it from inside Lovable; the env vars live in Vercel's project settings and are read at build time.

## Plan: Fix Vercel env vars + verify

### Step 1 — Update Vercel environment variables
In the Vercel dashboard for the `pay.ahmadiyyasciencecollege.ng` project:

**Settings → Environment Variables** — set (for Production, Preview, Development):

```
VITE_SUPABASE_URL            = https://xspfcdxymobmiksiudfo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = <the anon/publishable key from this Lovable Cloud project>
VITE_SUPABASE_PROJECT_ID     = xspfcdxymobmiksiudfo
```

The publishable key value is the `VITE_SUPABASE_PUBLISHABLE_KEY` already in this project's `.env`. I will paste it in chat once you confirm you want to proceed (it's a public anon key, safe to share).

Remove or overwrite any old values pointing at a different `*.supabase.co` URL.

### Step 2 — Redeploy
Trigger a fresh deploy in Vercel (Deployments → ⋯ → Redeploy, with **"Use existing build cache" off**). Vite inlines `VITE_*` vars at build time, so a redeploy is required — changing env vars alone won't update the live site.

### Step 3 — Verify
After the deploy completes, I'll use Playwright to:
1. Open `https://pay.ahmadiyyasciencecollege.ng/` on desktop (1280×1800) and mobile (390×844) viewports.
2. Inspect the page's network traffic to confirm auth POSTs go to `xspfcdxymobmiksiudfo.supabase.co/auth/v1/token` (not the old project).
3. Attempt login with `ascistudent@gmail.com` / `DemoStudent123!` and screenshot the resulting dashboard.
4. Re-check the Lovable Cloud auth logs to confirm the login attempt now appears with `referer: pay.ahmadiyyasciencecollege.ng`.

### Technical notes
- Vite env vars are compile-time substitutions, not runtime — that's why "just change env vars" without rebuilding does nothing.
- The publishable/anon key is safe in the browser; RLS protects data.
- If after redeploy the network tab still shows the old Supabase URL, the Vercel project may be deploying from a different Git branch/repo than expected — we'll check `Settings → Git` next.

### What I need from you
Confirm you want me to share the publishable key value here so you can paste it into Vercel, then redeploy. After your redeploy, reply and I'll run the Playwright verification.
