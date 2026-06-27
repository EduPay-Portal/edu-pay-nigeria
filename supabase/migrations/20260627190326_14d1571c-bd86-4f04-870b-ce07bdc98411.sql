ALTER TABLE public.virtual_account_provisioning_jobs
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS virtual_account_provisioning_jobs_next_retry_idx
  ON public.virtual_account_provisioning_jobs (status, next_retry_at)
  WHERE status = 'pending';
