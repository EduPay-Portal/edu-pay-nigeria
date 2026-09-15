# Fix: Payment Simulator student dropdown is empty

## What's happening

The data is there — 412 students have an active payment account. The page fails to read it because of how the student list is requested: it asks for student records and their names in one combined request, but the database has no direct link registered between the student record table and the names table. That request errors out, so the dropdown renders with nothing in it and clicking it shows no options.

The same combined-request pattern is used for the "Recent Test Payments" list at the bottom of the page, so that section is affected too.

## Fix

In `src/pages/dashboard/admin/PaymentSimulatorPage.tsx`:

1. `students-with-va` query: keep the active-virtual-account fetch, then fetch `student_profiles` for those IDs without the embedded `profiles!inner(...)`, fetch `profiles` (id, first_name, last_name) separately by the same IDs, and merge all three client-side. Sort by name so the list is usable.
2. `recent-simulations` query: drop the embedded `profiles!inner(...)`; fetch the transactions, then fetch the matching profiles by `user_id` and merge client-side.
3. Surface failures instead of silently rendering an empty control: show "Loading students..." while fetching, an error message if the query fails, and "No students with a virtual account" when the result is genuinely empty.

## Technical notes

- Root cause: `student_profiles.user_id` and `transactions.user_id` have foreign keys to `auth.users`, not to `public.profiles`, so PostgREST cannot resolve the `profiles!inner` embed and the request fails.
- This matches the existing project rule to avoid ambiguous PostgREST joins and merge related data client-side.
- Admin row-level security policies already allow reading all profiles, student profiles, and virtual accounts — no database or policy changes needed.
- Frontend-only change; one file touched.
