-- =====================================================
-- Paystack Virtual Accounts Integration - Phase 1
-- =====================================================
-- Creates virtual accounts system for student payment tracking

-- =====================================================
-- 1. VIRTUAL ACCOUNTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paystack_customer_code VARCHAR(100) UNIQUE NOT NULL,
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

-- Enable RLS
ALTER TABLE public.virtual_accounts ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_student_id ON public.virtual_accounts(student_id);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_account_number ON public.virtual_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_customer_code ON public.virtual_accounts(paystack_customer_code);

-- =====================================================
-- 2. ENHANCE TRANSACTIONS TABLE
-- =====================================================
-- Add Paystack-specific fields to existing transactions table
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS paystack_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(50),
  ADD COLUMN IF NOT EXISTS webhook_data JSONB;

-- Add index for Paystack references
CREATE INDEX IF NOT EXISTS idx_transactions_paystack_ref ON public.transactions(paystack_reference);

-- =====================================================
-- 3. PAYSTACK WEBHOOK EVENTS LOG
-- =====================================================
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

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_reference ON public.paystack_webhook_events(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.paystack_webhook_events(processed);

-- =====================================================
-- 4. RLS POLICIES FOR VIRTUAL ACCOUNTS
-- =====================================================

-- Students can view their own virtual account
CREATE POLICY "Users can read own virtual account"
  ON public.virtual_accounts FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- Admins can view all virtual accounts
CREATE POLICY "Admins can read all virtual accounts"
  ON public.virtual_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Parents can view their children's virtual accounts
CREATE POLICY "Parents can read children virtual accounts"
  ON public.virtual_accounts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.user_id = virtual_accounts.student_id
        AND sp.parent_id = auth.uid()
    )
  );

-- Only admins can insert virtual accounts (normally done via edge function)
CREATE POLICY "Admins can create virtual accounts"
  ON public.virtual_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update virtual accounts
CREATE POLICY "Admins can update virtual accounts"
  ON public.virtual_accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 5. RLS POLICIES FOR WEBHOOK EVENTS
-- =====================================================

ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook events
CREATE POLICY "Admins can read webhook events"
  ON public.paystack_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to update virtual account stats after payment
CREATE OR REPLACE FUNCTION public.update_virtual_account_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.paystack_reference IS NOT NULL THEN
    UPDATE public.virtual_accounts
    SET 
      total_received = total_received + NEW.amount,
      last_payment_at = NEW.created_at,
      updated_at = NOW()
    WHERE student_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update virtual account stats
DROP TRIGGER IF EXISTS trigger_update_virtual_account_stats ON public.transactions;
CREATE TRIGGER trigger_update_virtual_account_stats
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_virtual_account_stats();

-- Function to get virtual account by account number
CREATE OR REPLACE FUNCTION public.get_virtual_account_by_number(account_num TEXT)
RETURNS TABLE (
  id UUID,
  student_id UUID,
  paystack_customer_code VARCHAR(100),
  account_number VARCHAR(20),
  account_name VARCHAR(255),
  bank_name VARCHAR(100),
  is_active BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    student_id,
    paystack_customer_code,
    account_number,
    account_name,
    bank_name,
    is_active
  FROM public.virtual_accounts
  WHERE virtual_accounts.account_number = account_num
    AND is_active = true;
$$;

-- =====================================================
-- 7. UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_virtual_account_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_virtual_accounts_updated_at ON public.virtual_accounts;
CREATE TRIGGER trigger_virtual_accounts_updated_at
  BEFORE UPDATE ON public.virtual_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_virtual_account_updated_at();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables exist
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'virtual_accounts') = 1,
    'virtual_accounts table not created';
  
  ASSERT (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'paystack_webhook_events') = 1,
    'paystack_webhook_events table not created';
  
  RAISE NOTICE 'Phase 1 Paystack Migration: ✅ All tables created successfully';
END $$;
