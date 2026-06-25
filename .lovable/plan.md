## Diagnosis

The error banner shows only `message: Bad Request` — no `code`, `details`, or `hint`. That's the giveaway: this is not a PostgREST/RLS error (those always come back with a code and a JSON body). It's the edge/proxy rejecting the HTTP request itself before PostgREST sees it.

Why now and not on Lovable preview? You have **411 students**. The query in `StudentsPage.tsx` does:

```ts
supabase.from('profiles').select(...).in('id', allIds)   // allIds = user_ids ∪ parent_ids
supabase.from('wallets').select(...).in('user_id', userIds)
```

`.in()` is sent as a URL query string: `id=in.(uuid1,uuid2,…uuid800+)`. With ~800 UUIDs that URL is ~30 KB. Vercel's edge / Cloudflare in front of Supabase rejects very long URLs with a bare **400 Bad Request** (no JSON body), which is exactly what we're seeing. Lovable preview goes through a different edge with a more permissive URL limit, so it worked there.

The count-only query on `AdminDashboard` works because it sends no `.in()` list.

## Fix

Chunk the `.in(...)` lookups in `src/pages/dashboard/admin/StudentsPage.tsx` so no single request URL gets huge.

### Changes

1. Add a small helper inside the query function:
   ```ts
   const chunk = <T,>(arr: T[], size: number) =>
     Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
       arr.slice(i * size, i * size + size));
   ```
2. Replace the two `.in()` calls with chunked versions (chunk size **100**), running the chunks in parallel with `Promise.all` and concatenating results:
   - `profiles` → loop over `chunk(allIds, 100)`, each does `.select('id, first_name, last_name, email').in('id', ids)`.
   - `wallets` → loop over `chunk(userIds, 100)`, each does `.select('user_id, balance, currency').in('user_id', ids)`.
3. Keep the existing error logging / surfacing — if any chunk fails we still throw and the red alert renders the real PostgREST error.
4. No change to RLS, env vars, or business logic.

### Why chunk size 100

100 UUIDs ≈ 3.7 KB of query string — comfortably under every known edge URL limit (8 KB Cloudflare, 14 KB Vercel) with headroom for filters. Five parallel round-trips for 411 students is still well under one second.

### Verification

After deploying:
- Students table should populate with all 411 rows.
- If anything still fails, the red alert will now show a real PostgREST `code` + `details` (not a bare "Bad Request"), and we fix from there.

### Out of scope

- Pagination / server-side search — worth doing later for scale (>2,000 students), but not needed to unblock this bug.
- Removing the `.limit(2000)` — leave it; it's a safety cap.
