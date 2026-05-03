-- =========================================================
-- 003: Virtual accounts + webhook events
-- =========================================================
CREATE TABLE IF NOT EXISTS public.virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paystack_customer_code VARCHAR(100) UNIQUE,
  account_number VARCHAR(20) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  total_received DECIMAL(12,2) DEFAULT 0.00,
  last_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_student_virtual_account UNIQUE(student_id)
);
ALTER TABLE public.virtual_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_student_id ON public.virtual_accounts(student_id);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_account_number ON public.virtual_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_customer_code ON public.virtual_accounts(paystack_customer_code);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paystack_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(50),
  ADD COLUMN IF NOT EXISTS webhook_data JSONB;
CREATE INDEX IF NOT EXISTS idx_transactions_paystack_ref ON public.transactions(paystack_reference);

CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  paystack_reference VARCHAR(100) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_webhook_events_reference ON public.paystack_webhook_events(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.paystack_webhook_events(processed);

CREATE POLICY "Users can read own virtual account" ON public.virtual_accounts FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Admins can read all virtual accounts" ON public.virtual_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Parents can read children virtual accounts" ON public.virtual_accounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.student_profiles sp WHERE sp.user_id = virtual_accounts.student_id AND sp.parent_id = auth.uid()));
CREATE POLICY "Admins can create virtual accounts" ON public.virtual_accounts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update virtual accounts" ON public.virtual_accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read webhook events" ON public.paystack_webhook_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_virtual_account_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.paystack_reference IS NOT NULL THEN
    UPDATE public.virtual_accounts
    SET total_received = total_received + NEW.amount, last_payment_at = NEW.created_at, updated_at = NOW()
    WHERE student_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_update_virtual_account_stats ON public.transactions;
CREATE TRIGGER trigger_update_virtual_account_stats AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_virtual_account_stats();

CREATE OR REPLACE FUNCTION public.update_virtual_account_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trigger_virtual_accounts_updated_at BEFORE UPDATE ON public.virtual_accounts FOR EACH ROW EXECUTE FUNCTION public.update_virtual_account_updated_at();

-- =========================================================
-- 004: Bulk import staging
-- =========================================================
CREATE TABLE IF NOT EXISTS public.students_import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sn INTEGER, names TEXT, surname TEXT, class_level TEXT,
  reg_no TEXT, parent_name TEXT, parent_email TEXT, parent_phone TEXT,
  debt DECIMAL(10,2) DEFAULT 0.00,
  is_member BOOLEAN DEFAULT false, is_boarder BOOLEAN DEFAULT false,
  student_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT false, processing_error TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(), processed_at TIMESTAMPTZ,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  import_batch_id UUID DEFAULT gen_random_uuid(), notes TEXT
);
ALTER TABLE public.students_import_staging ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_staging_processed ON public.students_import_staging(processed);
CREATE INDEX IF NOT EXISTS idx_staging_batch_id ON public.students_import_staging(import_batch_id);

ALTER TABLE public.student_profiles 
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS created_from_import BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_notes TEXT,
  ADD COLUMN IF NOT EXISTS debt DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_member BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_boarder BOOLEAN DEFAULT false;

ALTER TABLE public.parent_profiles
  ADD COLUMN IF NOT EXISTS created_from_import BOOLEAN DEFAULT false;

CREATE POLICY "Admins can read staging records" ON public.students_import_staging FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert staging records" ON public.students_import_staging FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update staging records" ON public.students_import_staging FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete staging records" ON public.students_import_staging FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_import_staging_stats()
RETURNS TABLE (total_records BIGINT, processed_records BIGINT, pending_records BIGINT, error_records BIGINT, unique_batches BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*), COUNT(*) FILTER (WHERE processed = true AND processing_error IS NULL),
    COUNT(*) FILTER (WHERE processed = false), COUNT(*) FILTER (WHERE processing_error IS NOT NULL),
    COUNT(DISTINCT import_batch_id) FROM public.students_import_staging;
$$;

CREATE OR REPLACE FUNCTION public.mark_staging_processed(staging_id UUID, s_uuid UUID, p_uuid UUID DEFAULT NULL, error_msg TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.students_import_staging
  SET processed = (error_msg IS NULL), student_uuid = s_uuid, parent_uuid = p_uuid,
      processing_error = error_msg, processed_at = NOW()
  WHERE id = staging_id;
END;
$$;

-- =========================================================
-- 010: Reconciliation helpers
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_unmatched_webhooks()
RETURNS TABLE (id UUID, paystack_reference VARCHAR(100), event_type VARCHAR(100), payload JSONB, created_at TIMESTAMPTZ)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w.paystack_reference, w.event_type, w.payload, w.created_at
  FROM public.paystack_webhook_events w
  WHERE w.event_type = 'charge.success' AND w.signature_valid = true AND w.processed = true
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.paystack_reference = w.paystack_reference)
  ORDER BY w.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_duplicate_transactions()
RETURNS TABLE (paystack_reference VARCHAR(100), count BIGINT, total_amount DECIMAL(12,2), transactions JSONB)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.paystack_reference, COUNT(*)::BIGINT, SUM(t.amount)::DECIMAL(12,2),
    jsonb_agg(jsonb_build_object('id', t.id, 'reference', t.reference, 'amount', t.amount, 'status', t.status, 'created_at', t.created_at))
  FROM public.transactions t WHERE t.paystack_reference IS NOT NULL
  GROUP BY t.paystack_reference HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_orphaned_transactions()
RETURNS TABLE (id UUID, reference TEXT, paystack_reference VARCHAR(100), amount DECIMAL(12,2), status TEXT, created_at TIMESTAMPTZ, user_id UUID)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.reference, t.paystack_reference, t.amount, t.status::TEXT, t.created_at, t.user_id
  FROM public.transactions t
  WHERE t.paystack_reference IS NOT NULL AND t.type = 'credit'
    AND NOT EXISTS (SELECT 1 FROM public.paystack_webhook_events w WHERE w.paystack_reference = t.paystack_reference)
  ORDER BY t.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_reconciliation_summary()
RETURNS TABLE (metric VARCHAR(50), count BIGINT, total_amount DECIMAL(12,2))
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'unmatched_webhooks'::VARCHAR(50), COUNT(*)::BIGINT,
    SUM(COALESCE((w.payload->'data'->>'amount')::DECIMAL / 100, 0))::DECIMAL(12,2)
  FROM public.paystack_webhook_events w
  WHERE w.event_type = 'charge.success' AND w.signature_valid = true
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.paystack_reference = w.paystack_reference)
  UNION ALL
  SELECT 'duplicate_transactions'::VARCHAR(50), COUNT(DISTINCT paystack_reference)::BIGINT, SUM(amount)::DECIMAL(12,2)
  FROM public.transactions WHERE paystack_reference IN (SELECT paystack_reference FROM public.transactions WHERE paystack_reference IS NOT NULL GROUP BY paystack_reference HAVING COUNT(*) > 1)
  UNION ALL
  SELECT 'orphaned_transactions'::VARCHAR(50), COUNT(*)::BIGINT, SUM(amount)::DECIMAL(12,2)
  FROM public.transactions t WHERE t.paystack_reference IS NOT NULL AND t.type = 'credit'
    AND NOT EXISTS (SELECT 1 FROM public.paystack_webhook_events w WHERE w.paystack_reference = t.paystack_reference);
$$;

-- =========================================================
-- 011: Payment hardening
-- =========================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paystack';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transactions_payment_method_check') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN ('card','bank_transfer','simulation'));
  END IF;
END $$;

ALTER TABLE public.virtual_accounts ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paystack';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='virtual_accounts_provider_check') THEN
    ALTER TABLE public.virtual_accounts ADD CONSTRAINT virtual_accounts_provider_check
      CHECK (provider IN ('paystack','mock'));
  END IF;
END $$;

ALTER TABLE public.paystack_webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.apply_transaction_to_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF NEW.type = 'credit' THEN
    UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
  ELSIF NEW.type = 'debit' THEN
    UPDATE public.wallets SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_transaction_to_wallet ON public.transactions;
CREATE TRIGGER trg_apply_transaction_to_wallet AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_to_wallet();

CREATE OR REPLACE FUNCTION public.apply_status_change_to_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    IF NEW.type = 'credit' THEN
      UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
    ELSIF NEW.type = 'debit' THEN
      UPDATE public.wallets SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_status_change_to_wallet ON public.transactions;
CREATE TRIGGER trg_apply_status_change_to_wallet AFTER UPDATE OF status ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.apply_status_change_to_wallet();

CREATE INDEX IF NOT EXISTS idx_transactions_paystack_reference ON public.transactions(paystack_reference) WHERE paystack_reference IS NOT NULL;