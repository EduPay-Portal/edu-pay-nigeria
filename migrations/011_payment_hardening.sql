-- =====================================================
-- Payment Hardening: wallet auto-credit + provider fields
-- =====================================================

-- 1. Add provider/payment_method columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paystack';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transactions_payment_method_check') THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN ('card','bank_transfer','simulation'));
  END IF;
END $$;

ALTER TABLE public.virtual_accounts
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paystack';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='virtual_accounts_provider_check') THEN
    ALTER TABLE public.virtual_accounts
      ADD CONSTRAINT virtual_accounts_provider_check
      CHECK (provider IN ('paystack','mock'));
  END IF;
END $$;

-- Allow paystack_customer_code to be NULL for mock VAs
ALTER TABLE public.virtual_accounts
  ALTER COLUMN paystack_customer_code DROP NOT NULL;

-- Webhook event audit completeness
ALTER TABLE public.paystack_webhook_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 2. Wallet auto-credit trigger (single source of truth for balance mutations)
CREATE OR REPLACE FUNCTION public.apply_transaction_to_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'credit' THEN
    UPDATE public.wallets
      SET balance = balance + NEW.amount, updated_at = NOW()
      WHERE id = NEW.wallet_id;
  ELSIF NEW.type = 'debit' THEN
    UPDATE public.wallets
      SET balance = balance - NEW.amount, updated_at = NOW()
      WHERE id = NEW.wallet_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_transaction_to_wallet ON public.transactions;
CREATE TRIGGER trg_apply_transaction_to_wallet
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_transaction_to_wallet();

CREATE OR REPLACE FUNCTION public.apply_status_change_to_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status <> 'completed'
     AND NEW.status = 'completed' THEN
    IF NEW.type = 'credit' THEN
      UPDATE public.wallets
        SET balance = balance + NEW.amount, updated_at = NOW()
        WHERE id = NEW.wallet_id;
    ELSIF NEW.type = 'debit' THEN
      UPDATE public.wallets
        SET balance = balance - NEW.amount, updated_at = NOW()
        WHERE id = NEW.wallet_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_status_change_to_wallet ON public.transactions;
CREATE TRIGGER trg_apply_status_change_to_wallet
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_status_change_to_wallet();

CREATE INDEX IF NOT EXISTS idx_transactions_paystack_reference
  ON public.transactions(paystack_reference)
  WHERE paystack_reference IS NOT NULL;
