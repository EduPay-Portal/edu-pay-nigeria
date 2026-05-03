## Recreate your admin account

Your previous user no longer exists in the auth database. I'll recreate it directly using the backend service role so you can sign in immediately — no email confirmation needed.

### What I'll do

1. **Create a one-off Node script** (run from the sandbox, not committed) that:
   - Uses the Supabase service role key to call `auth.admin.createUser` with:
     - email: `skilldigitalskillhints@gmail.com`
     - password: `#Trophy1976##`
     - `email_confirm: true` (so you can sign in immediately)
     - user metadata: `{ first_name: "Admin", last_name: "User", role: "admin" }`
   - The existing `handle_new_user` trigger will auto-create the `profiles` row and the `user_roles` row with `admin`.
   - The existing `create_role_profile` trigger will auto-create the `admin_profiles` row.

2. **Verify** by querying `auth.users`, `user_roles`, and `admin_profiles` to confirm everything is wired up.

3. **Delete the script** after running so credentials never sit in the repo.

### After this

You'll be able to sign in at `/auth` with your credentials and land on the admin dashboard.

### Notes

- No code or migration changes — purely a one-time data operation.
- If a user with that email somehow already exists in a stale state, I'll delete and recreate it.
