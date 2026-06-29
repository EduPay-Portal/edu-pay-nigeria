## Verify the Vercel redeploy fixed login

Now that you've redeployed `pay.ahmadiyyasciencecollege.ng` with the corrected env vars, I'll confirm the live site is actually talking to the right backend and that login works.

### Steps

1. **Network check (desktop, 1280×1800)** — Open `https://pay.ahmadiyyasciencecollege.ng/` with Playwright, capture all network requests, and confirm:
   - Auth POSTs go to `xspfcdxymobmiksiudfo.supabase.co/auth/v1/token` (not the old project)
   - The `apikey` header matches the new publishable key

2. **Login attempt (desktop)** — Submit `ascistudent@gmail.com` / `DemoStudent123!`, screenshot the result. Expect redirect to `/dashboard/student`.

3. **Mobile viewport check (390×844)** — Repeat the login on a mobile viewport since that's where you originally hit the issue. Screenshot the dashboard.

4. **Backend log confirmation** — Query the auth logs for a login event with `referer: pay.ahmadiyyasciencecollege.ng` and `status: 200` in the last few minutes.

5. **Report** — Show you the screenshots, the auth-log entry, and a short pass/fail summary. If anything still points at the old backend, I'll inspect the served JS bundle to see what URL was actually baked in and tell you exactly what to fix in Vercel (likely a stale build cache or wrong Git branch).

No code changes — this is read-only verification.
