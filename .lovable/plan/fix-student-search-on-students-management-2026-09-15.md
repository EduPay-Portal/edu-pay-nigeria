# Fix: student search on Students Management

## What's wrong

The search box only looks at the admission number, class and registration number. Student names and email addresses are stored in a separate place, so typing a real student's name matches nothing and the list comes back empty.

There is a second, name-based filter that runs afterwards, but it can only see the rows the first search already returned — so it never rescues a name search.

## Fix (Students page only)

1. When the search text is not empty, first look up matching people by first name, last name or email and collect their IDs.
2. Include those IDs in the student query alongside the existing admission/class/registration matching, so a name search returns the right students with correct paging and counts.
3. Remove the after-the-fact client-side name filter, since the server search now covers names and emails (it currently hides valid rows when a name is only present on other pages).
4. Keep the existing "No students found matching your filters" empty state, plus the loading state while a search runs.

## Technical notes

- `buildStudentQuery` in `src/pages/dashboard/admin/StudentsPage.tsx` becomes async: query `profiles` with `.or(first_name.ilike.%q%,last_name.ilike.%q%,email.ilike.%q%)` (limit ~500 ids), then add `user_id.in.(...)` to the existing `.or(...)` on `student_profiles`.
- Full-name searches like "Asci Student" are handled by also splitting the term on whitespace and matching each part, so first+last name combinations resolve.
- Also apply the same builder to the CSV export path so exports match what is on screen.
- Frontend only; no database or policy changes needed.
