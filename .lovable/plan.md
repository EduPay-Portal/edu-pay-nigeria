## Problem

The DB confirms data exists: **411 students** in `student_profiles`, **253 parents** in `parent_profiles`, **665 profiles**. Yet the admin Students and Parents pages show 0/loading forever.

Root cause: the PostgREST embeds in `StudentsPage.tsx` and `ParentsPage.tsx` use FK hint joins to `profiles` that don't actually exist:

- `student_profiles.user_id` → FK to `auth.users(id)` (NOT to `public.profiles`)
- `parent_profiles.user_id` → FK to `auth.users(id)` (NOT to `public.profiles`)
- `public.profiles.id` → FK to `auth.users(id)`

So `select('*, profiles!student_profiles_user_id_fkey(...)')` and `select('*, profiles:user_id(...)')` fail because PostgREST can't traverse through `auth.users` to reach `public.profiles`. The query errors silently and the list stays empty (matches your existing memory: "Avoid nested joins for ambiguous relationships in PostgREST; use separate queries and merge client-side").

Same pattern breaks `parent_profile:parent_id(first_name,last_name)` on the students query.

## Fix

### 1. `src/pages/dashboard/admin/StudentsPage.tsx`
Replace the nested-embed query with three separate queries merged client-side:
1. `student_profiles` — all rows
2. `profiles` — `WHERE id IN (user_ids ∪ parent_ids)`
3. `wallets` — `WHERE user_id IN (user_ids)` (already separate, keep)

Then attach: `profiles` (by `user_id = profile.id`), `parent_profile` (by `parent_id = profile.id`), and `wallets` to each student.

### 2. `src/pages/dashboard/admin/ParentsPage.tsx`
Same approach:
1. `parent_profiles` — all rows
2. `profiles` — `WHERE id IN (parent user_ids)`
3. Children count per parent (keep existing per-parent count, or batch into one `student_profiles` query grouped client-side for performance with 253 parents)

### 3. Bonus fix (related, surfaced in logs)
The bulk-create-students function wrote `"NON_MEMBER"` for membership but the DB CHECK constraint only allows `MEMBER` / `NMEMBER`, causing 12 records to fail. Fix the mapping in `supabase/functions/bulk-create-students/index.ts`:
```
const membershipStatus = record["MEMBER/NMEMBER"] === "MEMBER" ? "MEMBER" : "NMEMBER";
```
Then re-run "Process All Pending" to clear the remaining 12 errored records (currently the staging stats card shows Pending 0 / Errors 0 because the failed rows were marked with `error_message` but the count display is fine — we'll verify).

## Verification

After deploy:
- Students page should show 411 students with names, classes, balances
- Parents page should show 253 parents with children counts
- Re-run bulk processing for any remaining errored rows

No DB migration required — purely client-side query refactor (plus one edge function string fix).