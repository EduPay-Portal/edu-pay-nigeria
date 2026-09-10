-- Wema VAS: account status + block tracking
ALTER TABLE public.virtual_accounts
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS block_reason text;

ALTER TABLE public.virtual_accounts
  DROP CONSTRAINT IF EXISTS virtual_accounts_account_status_check;
ALTER TABLE public.virtual_accounts
  ADD CONSTRAINT virtual_accounts_account_status_check
  CHECK (account_status IN ('active', 'inactive', 'blocked'));

CREATE UNIQUE INDEX IF NOT EXISTS virtual_accounts_account_number_key
  ON public.virtual_accounts (account_number);

-- Wema VAS: NIP session identifier + response codes on transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS nibss_response text,
  ADD COLUMN IF NOT EXISTS send_response text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_session_id_key
  ON public.transactions (session_id) WHERE session_id IS NOT NULL;

-- Serial used to build the 7-digit suffix of a NUBAN
CREATE SEQUENCE IF NOT EXISTS public.wema_va_serial_seq START WITH 234567 INCREMENT BY 1 MAXVALUE 9999999 CYCLE;

CREATE OR REPLACE FUNCTION public.allocate_virtual_account_number(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  IF p_prefix !~ '^[0-9]{3}$' THEN
    RAISE EXCEPTION 'Virtual account prefix must be exactly 3 digits, got %', p_prefix;
  END IF;

  LOOP
    tries := tries + 1;
    candidate := p_prefix || LPAD(nextval('public.wema_va_serial_seq')::text, 7, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.virtual_accounts WHERE account_number = candidate
    );
    IF tries > 50 THEN
      RAISE EXCEPTION 'Could not allocate a free virtual account number for prefix %', p_prefix;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_virtual_account_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_virtual_account_number(text) TO service_role;