## Problem

Login on `https://edu-pay-nigeria.vercel.app/auth` fails with **"Sign in failed — Failed to fetch"**. The Supabase client built into the Vercel bundle has an `undefined` API key, so every network call to your backend fails before it leaves the browser.

## Root Cause

The auto-generated Supabase client reads two specific env var names:

```text
VITE_SUPABASE_URL                ← set on Vercel  ✅
VITE_SUPABASE_PUBLISHABLE_KEY    ← NOT set on Vercel  ❌
```

Your Vercel project has `VITE_SUPABASE_ANON_KEY` instead. Vite only inlines variables that exist at build time under the exact name the code references, so the publishable key ends up `undefined` in production.

## Fix (you do this in Vercel — no code change needed)

In **Vercel → Project Settings → Environment Variables**, for the **Production** (and Preview) environment:

1. **Add** a new variable:
   - Name: `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Value: the **anon / publishable key** of your new self-hosted Supabase project (`fmajhzepqpnrzbtcdiix`) — the same JWT you currently have under `VITE_SUPABASE_ANON_KEY`.
2. **Add** (optional but recommended for the types generator):
   - Name: `VITE_SUPABASE_PROJECT_ID`
   - Value: `fmajhzepqpnrzbtcdiix`
3. You can keep `VITE_SUPABASE_ANON_KEY` — `src/lib/env.ts` still reads it for validation. (Both names should point to the same anon key.)
4. **Trigger a redeploy** in Vercel (Deployments → ⋯ → Redeploy, with "Use existing build cache" **off**) so Vite re-inlines the new variables.

## Verification

After redeploy, on `https://edu-pay-nigeria.vercel.app/auth`:

1. Open DevTools → Network.
2. Try to log in.
3. You should see a `POST https://fmajhzepqpnrzbtcdiix.supabase.co/auth/v1/token?grant_type=password` request that returns **200** (or **400 invalid credentials** if the user doesn't exist yet — but no longer "Failed to fetch").

## Things that will still bite you after this fix

These are NOT the cause of "Failed to fetch", but you'll hit them next:

- **Users can't sign in until you restore `auth.users` + `auth.identities`** into the new project. Password-based logins for any pre-migration user (including admins) will fail with "Invalid login credentials" until that dump is restored.
- **Google OAuth** must be re-enabled in your new Supabase project's Auth → Providers with the same Google Client ID/Secret, and `https://edu-pay-nigeria.vercel.app` must be added to **Site URL** and **Redirect URLs**.
- **Site URL** in Auth settings should be set to `https://edu-pay-nigeria.vercel.app` so email confirmation / password reset links point there instead of localhost.

## Out of scope for this plan

The Students / Parents / Transactions empty-list issue from the earlier turn is a separate code bug (PostgREST embed without a FK) and will be addressed in its own plan once this auth fix is verified working.
