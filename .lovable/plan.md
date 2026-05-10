## Problem

Creating a Wema virtual account fails with:
```
duplicate key value violates unique constraint "unique_student_virtual_account"
```

The `virtual_accounts` table has a `UNIQUE (student_id)` constraint — only **one row per student**, ever. But the Wema migration archived old Paystack DVAs (`status='archived'`, `is_active=false`) instead of deleting them. When `dva-create` tries to insert a new Wema row for the same student, it collides with the archived Paystack row.

The `dva-create` function correctly skips when an *active* DVA already exists for the requested provider, but the DB constraint is stricter than the application logic.

## Fix

Replace the column-level uniqueness with a **partial unique index** that only enforces uniqueness on *active* rows, so:
- A student can have at most one **active** DVA per provider
- Archived/historical DVAs (Paystack) coexist with new active Wema DVAs
- Reissue and provider switching work cleanly

### Migration

```sql
ALTER TABLE public.virtual_accounts
  DROP CONSTRAINT IF EXISTS unique_student_virtual_account;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_va_per_student_provider
  ON public.virtual_accounts (student_id, provider)
  WHERE status = 'active';
```

No app code changes needed — `dva-create` already guards against duplicate active rows in the same provider.

## Verification

1. Retry "Create VA" from `/dashboard/admin/students` — should succeed and produce a Wema NUBAN row.
2. Re-running it for the same student returns the existing active account (no duplicate).
3. Old archived Paystack rows remain intact for historical reference.
