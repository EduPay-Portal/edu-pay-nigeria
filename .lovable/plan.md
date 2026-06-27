## Plan

1. **Harden backend authorization**
   - Update `create-virtual-account` so it performs its own role-aware authorization instead of blindly forwarding requests.
   - Keep direct student/parent calls blocked, but return clear JSON with `request_id`, user role, and a friendly message instead of an unhandled 403.
   - Keep the actual DVA creation path admin/service-role protected through `dva-create`.

2. **Add provisioning audit logs**
   - Log every virtual account creation attempt: started, unauthorized, already exists, success, and failure.
   - Include `actor_id`, resolved `actor_role`, `student_id`, `request_id`, provider, IP, and failure reason in `audit_logs.metadata`.
   - Reuse the existing `audit_logs` table and `writeAudit` helper.

3. **Automatic student provisioning workflow**
   - Add a backend-only provisioning function for student registration events, using service-role credentials to call the admin-protected `dva-create` path.
   - Add a database trigger/function on student role/profile creation to enqueue/call provisioning for new students.
   - Make the workflow idempotent so duplicate registrations or retries do not create duplicate active virtual accounts.

4. **Friendly student/parent UI handling**
   - Update virtual account UI so students/parents never see or trigger the admin-only “Create Virtual Account” action.
   - Display a clear state such as “Your virtual account is being set up” with guidance to contact the bursary/admin if it persists.
   - Update the virtual account creation hook to surface readable errors for admins instead of throwing generic runtime errors.

5. **Fix broken dashboard links shown in screenshots**
   - Add routes or redirects for `/dashboard/student/wallet`, `/dashboard/student/transactions`, and `/profile/edit` so sidebar links no longer land on the 404 page.
   - Keep them within the existing student dashboard/profile UI rather than creating unrelated new pages.

6. **Validate**
   - Run targeted checks for edge function behavior and frontend routing.
   - Verify non-admin users no longer get a blank screen, and admin virtual account creation still works with audit entries.