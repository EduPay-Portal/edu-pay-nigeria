## Diagnosis

Your Vercel environment and Supabase project don't match what the app code expects. Two issues:

### Issue 1: Variable name mismatch
Your code (`src/integrations/supabase/client.ts`) reads:
- `VITE_SUPABASE_URL` ✅ (you have this)
- `VITE_SUPABASE_PUBLISHABLE_KEY` ❌ (Vercel has `VITE_SUPABASE_ANON_KEY` instead)

Result: the Supabase client is initialized with `undefined` key → every request fails with "Failed to fetch".

### Issue 2: Supabase publishable key unavailable
Your Supabase dashboard screenshot shows **"Publishable key unavailable"**. This means the project hasn't finished provisioning its API keys, OR you're looking at the wrong panel. The anon/publishable JWT key must exist for the frontend to authenticate.

---

## Recommended fix (no code changes needed)

### Step 1 — Get the anon key from Supabase
In your Supabase dashboard for `fmajhzepqpnrzbtcdiix`:
- Go to **Project Settings → API Keys** (not the "Copy" dropdown on the project home)
- Copy the **`anon` `public`** JWT (long string starting with `eyJ...`)
- If that page also says "unavailable", the project provisioning is incomplete — contact Supabase support or recreate the project.

### Step 2 — Fix Vercel environment variables
In Vercel → Project → Settings → Environment Variables, add **both** names pointing to the same anon key value:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://fmajhzepqpnrzbtcdiix.supabase.co` (keep) |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (keep — used by `src/lib/env.ts` validator) |
| **`VITE_SUPABASE_PUBLISHABLE_KEY`** | `eyJ...` (**ADD THIS** — same value as anon key) |
| `VITE_SUPABASE_PROJECT_ID` | `fmajhzepqpnrzbtcdiix` (add, optional but recommended) |
| `VITE_PAYSTACK_PUBLIC_KEY` | `pk_test_...` (keep) |

### Step 3 — Redeploy
Vercel → Deployments → latest → **Redeploy** with "Use existing Build Cache" **OFF**. Vite inlines env vars at build time, so a cached build will still have the old (missing) values.

### Step 4 — Verify
Visit `https://edu-pay-nigeria.vercel.app/auth` → DevTools → Network:
- You should see `POST https://fmajhzepqpnrzbtcdiix.supabase.co/auth/v1/token?grant_type=password`
- Status should be **200** (success) or **400** (bad credentials) — no more "Failed to fetch"

---

## Alternative (cleaner long-term fix — requires code change)

Standardize on `VITE_SUPABASE_ANON_KEY` everywhere and stop maintaining two names. This would edit `src/integrations/supabase/client.ts` to read `VITE_SUPABASE_ANON_KEY`. Say the word and I'll switch to build mode and apply it.

---

## Out of scope (separate bug, already tracked)
The Students/Parents/Transactions empty-list issue on the dashboard is a PostgREST embed/FK problem in the queries — unrelated to env vars. I'll plan that fix separately once auth is working.
