## Create two demo accounts

Create a student and a parent demo account directly in the backend using the existing `admin-create-user` edge function pattern (via a one-off SQL/auth admin call through the migration tool's secure path is not appropriate for auth.users — instead we'll insert via Supabase Auth admin API using a short script invocation).

Since `auth.users` cannot be inserted via SQL migrations safely, use the existing `admin-create-user` edge function flow by calling it through a temporary admin-bootstrap path. The cleanest method already available in this codebase:

### Approach
Use `supabase.auth.admin.createUser` via a small one-off invocation of the existing `admin-create-user` edge function. The function requires an admin caller, so the actual creation will be done by running a direct script against the backend in build mode using the service role (server-side only, never exposed to client).

### Accounts to create

| Email | Password | Role | First / Last name |
|---|---|---|---|
| ascistudent@gmail.com | (you choose — I'll ask) | student | Asci / Student |
| asciparent@gmail.com  | (you choose — I'll ask) | parent  | Asci / Parent  |

### What happens automatically after creation
- `handle_new_user` trigger inserts row in `public.profiles`
- `handle_new_user` trigger inserts row in `public.user_roles` with the chosen role
- `create_role_profile` trigger creates the matching `student_profiles` / `parent_profiles` row
- `create_user_wallet` trigger creates an NGN wallet (balance 0)
- For the student, the auto-VA trigger (migration 009) will request a Wema virtual account via `dva-create`

### Out of scope
- Linking the parent to the student (can be done after, via admin UI)
- Funding the wallet
- Setting custom admission number / class for the student (defaults: `ADM-XXXXXX`, class `Not Assigned`) — editable later in the admin Students page

### Technical notes
Execution in build mode will call the backend admin auth API server-side with email_confirm=true so both accounts can log in immediately without email verification.
