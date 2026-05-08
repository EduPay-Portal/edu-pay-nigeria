
-- =====================================================
-- Wema Bank DVA refactor: provider-agnostic payment schema
-- =====================================================

-- 1. EXTEND virtual_accounts ----------------------------------------
ALTER TABLE public.virtual_accounts
  ADD COLUMN IF NOT EXISTS provider_account_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.virtual_accounts
  ALTER COLUMN provider SET DEFAULT 'wema';

-- backfill: paystack_customer_code -> provider_customer_id
UPDATE public.virtual_accounts
  SET provider_customer_id = paystack_customer_code
  WHERE provider_customer_id IS NULL AND paystack_customer_code IS NOT NULL;

-- archive existing paystack DVAs
UPDATE public.virtual_accounts
  SET provider = 'paystack',
      status = 'archived',
      is_active = false
  WHERE provider IS NULL OR provider = 'paystack';

-- 2. EXTEND transactions --------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS settlement_id UUID,
  ADD COLUMN IF NOT EXISTS payer_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payer_bank TEXT,
  ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'auto';

-- backfill provider_reference from paystack_reference
UPDATE public.transactions
  SET provider_reference = paystack_reference
  WHERE provider_reference IS NULL AND paystack_reference IS NOT NULL;

-- ensure provider column has sane default
UPDATE public.transactions SET provider = 'paystack' WHERE provider IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_provider_ref
  ON public.transactions(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

-- 3. NEW: webhook_events --------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_reference TEXT,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_ref
  ON public.webhook_events(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_created
  ON public.webhook_events(provider, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read webhook events"
  ON public.webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. NEW: reconciliation_logs ---------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID,
  student_id UUID,
  expected_amount NUMERIC(12,2),
  received_amount NUMERIC(12,2),
  match_type TEXT NOT NULL, -- auto | manual | unmatched | over | under | duplicate
  notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_match_type
  ON public.reconciliation_logs(match_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_student
  ON public.reconciliation_logs(student_id);

ALTER TABLE public.reconciliation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read reconciliation logs"
  ON public.reconciliation_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert reconciliation logs"
  ON public.reconciliation_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reconciliation logs"
  ON public.reconciliation_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. NEW: settlements -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  settlement_date DATE NOT NULL,
  gross_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  fees NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  bank_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_provider_date
  ON public.settlements(provider, settlement_date DESC);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read settlements"
  ON public.settlements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage settlements"
  ON public.settlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. NEW: audit_logs ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger for settlements
DROP TRIGGER IF EXISTS trg_settlements_updated_at ON public.settlements;
CREATE TRIGGER trg_settlements_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
