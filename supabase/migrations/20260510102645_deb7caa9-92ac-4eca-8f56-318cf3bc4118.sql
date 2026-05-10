ALTER TABLE public.virtual_accounts DROP CONSTRAINT IF EXISTS unique_student_virtual_account;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_va_per_student_provider
  ON public.virtual_accounts (student_id, provider)
  WHERE status = 'active';