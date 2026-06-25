## Goal
Restrict account creation to admin-provisioned users only by removing public sign-up from the Auth page.

## Changes

**`src/pages/Auth.tsx`**
- Remove the "Sign Up" tab / toggle and its form (first name, last name, role selector, password rules UI).
- Render only the Sign In form as the default and only view.
- Remove any "Don't have an account? Sign up" links.
- Keep "Forgot password" flow intact.
- Remove now-unused imports (signUpSchema, SignUpFormData, role select, etc.).

**`src/pages/Index.tsx`** (landing page)
- Replace any "Sign Up" / "Create account" CTAs with "Sign In" (or remove them) so nothing routes to a signup view.

**Supabase Auth config**
- Call `configure_auth` with `disable_signup: true` so the backend itself rejects any signup attempt (defense in depth — even if someone hits the API directly, no account is created). Admins can still create users via the existing `admin-create-user` edge function because it uses the service role.

## Out of scope
- No changes to admin user-creation flows (`AddParentDialog`, `AddStudentDialog`, `admin-create-user`, bulk import) — those continue to work.
- No changes to existing users, roles, RLS, or sign-in behavior.
- No password reset changes.

## Verification
- `/auth` shows only Sign In.
- Landing page has no sign-up CTA.
- Direct call to `supabase.auth.signUp` returns "Signups not allowed".
- Admin can still create new parent/student accounts from the dashboard.
