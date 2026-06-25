## Two changes

### 1. Server-side pagination on the Students table

Today `StudentsPage.tsx` loads all rows (up to 2000) and filters/searches client-side. With 411+ students this is also why the request URL blew up. We'll push paging, search, and filters to PostgREST.

**Query refactor in `src/pages/dashboard/admin/StudentsPage.tsx`**

- Add state: `page` (default 1), `pageSize` (default 50).
- Replace the single `admin-students` query with a paginated one keyed on `['admin-students', page, pageSize, searchQuery, filters]`:
  - Use `.select('*', { count: 'exact' })` on `student_profiles`.
  - Apply filters server-side:
    - `classLevels` → `.in('class_level', filters.classLevels)`
    - `membershipStatus` → `.in('membership_status', …)`
    - `boardingStatus` → `.in('boarding_status', …)`
    - `hasDebt === true` → `.gt('debt_balance', 0)`; `false` → `.or('debt_balance.is.null,debt_balance.eq.0')`
    - `searchQuery` → `.or('admission_number.ilike.%q%,class_level.ilike.%q%,registration_number.ilike.%q%')` (name search handled below)
  - `.order('created_at', { ascending: false })` then `.range((page-1)*pageSize, page*pageSize - 1)`.
- After student rows return, fetch their `profiles` (user + parent) and `wallets` with the existing **chunked `.in()`** logic — but now the page is at most 50 rows, so one round-trip each.
- Name search: because first/last names live on `profiles`, run a parallel small lookup — when `searchQuery` is non-empty, first query `profiles` (`.or('first_name.ilike,last_name.ilike,email.ilike')` limited to e.g. 500 ids) and pass those `user_ids` into the `student_profiles` query via `.in('user_id', ids)` combined with the other search via `.or()` on a separate fetch then merge. Simpler: run two parallel paged queries (by-name-hits + by-admission-hits) and merge — but that complicates paging. **Chosen approach:** keep the search box for admission/class/registration only (server-side ilike), and add a small note "Search by name uses the Filter panel" — OR, simpler, keep client-side name filter applied *on top of* the current page. We'll go with: server-side search on `admission_number`, `class_level`, `registration_number`; name still client-filters the current page. This is the common pattern and avoids a costly cross-table search.
- Remove the `.limit(2000)` cap.

**Stats refactor**

The five stat cards currently compute from the loaded array (which is now only 50 rows). Replace with a separate lightweight `['admin-students-stats']` query that runs server aggregates:

- Total students: `select('id', { count: 'exact', head: true })` on `student_profiles`.
- Sum of `school_fees`, sum of wallet `balance`, and VA count via an RPC `get_student_stats()` (new SECURITY DEFINER function returning `{ total_students, total_school_fees, total_wallet_balance, va_count }`).
- Avg balance computed on client from the returned totals.
- "Active Students" stays equal to total for now (matches current behaviour).

**Pagination UI**

Below the table, add a footer row:
- Left: `Showing X–Y of N students`.
- Right: `Previous` / `Page n of m` / `Next` buttons (shadcn `Button` with `ChevronLeft`/`ChevronRight`).
- Page size selector (25 / 50 / 100) using shadcn `Select`.

**Loading & empty states**

- Show a skeleton table on first load and an inline spinner overlay when paging.
- Keep the existing red `Alert` for `studentsError`.

**Export Credentials**

`handleExportCredentials` currently exports the in-memory list — which would now only be the visible page. Change it to fetch all matching rows (respecting filters, ignoring pagination) in chunks of 1000 via `.range()` loops, then build the CSV. Keep the existing toast.

**Bulk-VA banner**

`studentsWithoutVA = totalStudents - virtualAccountsCount` keeps working because both come from server aggregates.

### 2. Rename the app to "Ahmadiyya Science College Ilaro – Payment Portal (ASCI)"

Use two display forms:
- **Full**: `Ahmadiyya Science College Ilaro – Payment Portal` (page titles, hero, footer, receipts).
- **Short**: `ASCI Payment Portal` (sidebar collapsed state, nav, small chips).

**Files to update (user-facing strings only — leave existing email domains, DB data, migration files, and internal log prefixes untouched):**

- `index.html` — `<title>`, `meta[name=author]`, `meta[name=description]` (mention ASCI), `og:title`, `og:description`, `twitter:title`, `twitter:description`.
- `src/pages/Index.tsx` — replace all "EduPay Connect" / "EduPay" mentions in headings, hero copy, testimonials, CTA, footer copyright, and `<img alt>`.
- `src/pages/Auth.tsx` — heading copy and `<img alt>`.
- `src/components/dashboard/Sidebar.tsx` — `<img alt>` to "ASCI Payment Portal" + add a small wordmark next to logo when expanded.
- `src/lib/receipt.ts` — change the receipt header line to `Ahmadiyya Science College Ilaro — Payment Portal`.
- `src/pages/dashboard/admin/SettingsPage.tsx` — default `school-name` value updated to `Ahmadiyya Science College Ilaro`.

**Not changed (out of scope / would break things):**

- `@edupay.school` email domain in `bulk-create-students`, `CSVUploadCard`, staging migration — these are real account identifiers already in the database.
- `[EduPay …]` log prefixes in `src/lib/logger.ts` (internal only).
- Docs (`ONBOARDING.md`, `MIGRATION.md`, `SUPABASE_SETUP.md`) — keep referring to the codebase by its repo name.
- The published Lovable subdomain `edu-pay-nigeria.lovable.app` — that's a deploy URL, not in code.
- The logo image asset itself (`logo_edupay.png`) — keep the file, only update its `alt` text. If you want a new logo I'll need an upload.

### Verification

- Open Students page → table shows 50 rows, paging buttons work, total count = 411.
- Apply a class filter → page resets to 1 and count updates.
- Type in search → admission/class/registration matches show up across the dataset; name typing narrows the visible page.
- Export Credentials → CSV contains all 411 rows (or filtered count).
- Browser tab title and landing/login pages show the new ASCI name.

## Technical notes

- The new RPC `get_student_stats()` will be a single migration, `SECURITY DEFINER`, restricted via `has_role(auth.uid(),'admin')` inside the function body — no policy needed.
- React Query: use `keepPreviousData: true` so the table doesn't blank between pages.
- All chunked-`.in()` logic from the previous fix stays — it's still used for profiles/wallets lookups per page.
