## Context

- Same code, same database (411 students confirmed via SQL, RLS policies are correct and use `has_role()`).
- **Lovable preview** → Students page loads correctly.
- **Vercel deploy** → Students page shows "No students found" even though the Admin Dashboard's count query on the same table returns 411.

Since count succeeds but `select('*')` returns nothing, the `select` is almost certainly throwing a runtime error that React Query swallows into the UI as an empty list. The Vercel deploy hides this because we don't render the error.

## Plan

### 1. Make Supabase errors visible on the Students page

Edit `src/pages/dashboard/admin/StudentsPage.tsx`:

- Pull `error` out of the `useQuery` for `admin-students`.
- Add a `console.error('admin-students query failed', error)` inside the query function before re-throwing.
- Render an `Alert` (destructive) above the table whenever `error` is truthy, showing `error.message` and (if present) `error.code` / `error.details` / `error.hint`. PostgREST returns these and they will tell us exactly what's wrong (RLS denial, column missing, row limit, JWT issue, etc.).

This is a tiny, presentation-only change — no business logic touched.

### 2. Redeploy to Vercel and capture the error

Once the change is live on `edu-pay-nigeria.vercel.app`:

1. Open the Students page.
2. Screenshot the red error banner (or copy the text).
3. Also open DevTools → Network → click the failing `student_profiles` request → copy the response body.

### 3. Apply the targeted fix

Based on the error text, the fix will be one of:

- **JWT / auth mismatch on Vercel** (e.g. `JWT expired`, `invalid JWT`, or `permission denied`) → re-check that the Vercel `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are from the **same** Supabase project (both must belong to the new project, not a mix of old/new). Force a redeploy with build cache OFF.
- **`Row level security` / `permission denied for table student_profiles`** → re-check the admin's row in `public.user_roles` exists in the new project for the logged-in admin's `auth.uid()`.
- **`max-rows` / 416 range error from `.limit(2000)`** → lower the limit (e.g. 1000) or remove it.
- **Network/CORS** → adjust Supabase project's allowed origins.

I will only ship the actual fix after we see the real error — no guessing.

### Why this is the right next step

The database, RLS, and code are all known-good (proved by preview working). The only unknown is what Vercel's runtime is reporting, and right now the app hides it. Step 1 unblocks every other guess.
