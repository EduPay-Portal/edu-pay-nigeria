CREATE TABLE IF NOT EXISTS public.virtual_account_provisioning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'wema',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  request_id text,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, provider)
);

GRANT SELECT ON public.virtual_account_provisioning_jobs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.virtual_account_provisioning_jobs TO authenticated;
GRANT ALL ON public.virtual_account_provisioning_jobs TO service_role;

ALTER TABLE public.virtual_account_provisioning_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can read own provisioning jobs" ON public.virtual_account_provisioning_jobs;
CREATE POLICY "Students can read own provisioning jobs"
  ON public.virtual_account_provisioning_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can read all provisioning jobs" ON public.virtual_account_provisioning_jobs;
CREATE POLICY "Admins can read all provisioning jobs"
  ON public.virtual_account_provisioning_jobs
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage provisioning jobs" ON public.virtual_account_provisioning_jobs;
CREATE POLICY "Admins can manage provisioning jobs"
  ON public.virtual_account_provisioning_jobs
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS virtual_account_provisioning_jobs_status_created_at_idx
  ON public.virtual_account_provisioning_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS virtual_account_provisioning_jobs_student_provider_idx
  ON public.virtual_account_provisioning_jobs (student_id, provider);

DROP TRIGGER IF EXISTS set_virtual_account_provisioning_jobs_updated_at ON public.virtual_account_provisioning_jobs;
CREATE TRIGGER set_virtual_account_provisioning_jobs_updated_at
  BEFORE UPDATE ON public.virtual_account_provisioning_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.enqueue_student_virtual_account_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO public.virtual_account_provisioning_jobs (student_id, provider, status, metadata)
    VALUES (NEW.user_id, 'wema', 'pending', jsonb_build_object('source', 'user_roles_trigger'))
    ON CONFLICT (student_id, provider) DO UPDATE
      SET status = CASE
          WHEN public.virtual_account_provisioning_jobs.status = 'completed' THEN public.virtual_account_provisioning_jobs.status
          ELSE 'pending'
        END,
        last_error = CASE
          WHEN public.virtual_account_provisioning_jobs.status = 'completed' THEN public.virtual_account_provisioning_jobs.last_error
          ELSE NULL
        END,
        metadata = public.virtual_account_provisioning_jobs.metadata || jsonb_build_object('source', 'user_roles_trigger_retry'),
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_student_virtual_account_provisioning() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_student_virtual_account_provisioning() TO service_role;

DROP TRIGGER IF EXISTS on_student_virtual_account_provisioning_queue ON public.user_roles;
CREATE TRIGGER on_student_virtual_account_provisioning_queue
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_student_virtual_account_provisioning();