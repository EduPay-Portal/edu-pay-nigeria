-- =====================================================
-- Payment Reconciliation Helper Functions
-- =====================================================
-- Creates database functions to identify payment discrepancies

-- =====================================================
-- 1. GET UNMATCHED WEBHOOKS
-- =====================================================
-- Returns webhooks that don't have corresponding transactions
CREATE OR REPLACE FUNCTION public.get_unmatched_webhooks()
RETURNS TABLE (
  id UUID,
  paystack_reference VARCHAR(100),
  event_type VARCHAR(100),
  payload JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    w.id,
    w.paystack_reference,
    w.event_type,
    w.payload,
    w.created_at
  FROM public.paystack_webhook_events w
  WHERE w.event_type = 'charge.success'
    AND w.signature_valid = true
    AND w.processed = true
    AND NOT EXISTS (
      SELECT 1 
      FROM public.transactions t 
      WHERE t.paystack_reference = w.paystack_reference
    )
  ORDER BY w.created_at DESC;
$$;

-- =====================================================
-- 2. GET DUPLICATE TRANSACTIONS
-- =====================================================
-- Returns transactions with duplicate paystack references
CREATE OR REPLACE FUNCTION public.get_duplicate_transactions()
RETURNS TABLE (
  paystack_reference VARCHAR(100),
  count BIGINT,
  total_amount DECIMAL(12,2),
  transactions JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.paystack_reference,
    COUNT(*) as count,
    SUM(t.amount) as total_amount,
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'reference', t.reference,
        'amount', t.amount,
        'status', t.status,
        'created_at', t.created_at
      )
    ) as transactions
  FROM public.transactions t
  WHERE t.paystack_reference IS NOT NULL
  GROUP BY t.paystack_reference
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
$$;

-- =====================================================
-- 3. GET ORPHANED TRANSACTIONS
-- =====================================================
-- Returns transactions without corresponding webhook events
CREATE OR REPLACE FUNCTION public.get_orphaned_transactions()
RETURNS TABLE (
  id UUID,
  reference VARCHAR(100),
  paystack_reference VARCHAR(100),
  amount DECIMAL(12,2),
  status VARCHAR(50),
  created_at TIMESTAMPTZ,
  user_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.reference,
    t.paystack_reference,
    t.amount,
    t.status,
    t.created_at,
    t.user_id
  FROM public.transactions t
  WHERE t.paystack_reference IS NOT NULL
    AND t.type = 'credit'
    AND NOT EXISTS (
      SELECT 1 
      FROM public.paystack_webhook_events w 
      WHERE w.paystack_reference = t.paystack_reference
    )
  ORDER BY t.created_at DESC;
$$;

-- =====================================================
-- 4. GET RECONCILIATION SUMMARY
-- =====================================================
-- Returns a summary of all reconciliation issues
CREATE OR REPLACE FUNCTION public.get_reconciliation_summary()
RETURNS TABLE (
  metric VARCHAR(50),
  count BIGINT,
  total_amount DECIMAL(12,2)
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Unmatched webhooks
  SELECT 
    'unmatched_webhooks'::VARCHAR(50) as metric,
    COUNT(*)::BIGINT as count,
    SUM(COALESCE((w.payload->'data'->>'amount')::DECIMAL / 100, 0))::DECIMAL(12,2) as total_amount
  FROM public.paystack_webhook_events w
  WHERE w.event_type = 'charge.success'
    AND w.signature_valid = true
    AND NOT EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.paystack_reference = w.paystack_reference
    )
  
  UNION ALL
  
  -- Duplicate transactions
  SELECT 
    'duplicate_transactions'::VARCHAR(50) as metric,
    COUNT(DISTINCT paystack_reference)::BIGINT as count,
    SUM(amount)::DECIMAL(12,2) as total_amount
  FROM public.transactions
  WHERE paystack_reference IN (
    SELECT paystack_reference 
    FROM public.transactions 
    WHERE paystack_reference IS NOT NULL 
    GROUP BY paystack_reference 
    HAVING COUNT(*) > 1
  )
  
  UNION ALL
  
  -- Orphaned transactions
  SELECT 
    'orphaned_transactions'::VARCHAR(50) as metric,
    COUNT(*)::BIGINT as count,
    SUM(amount)::DECIMAL(12,2) as total_amount
  FROM public.transactions t
  WHERE t.paystack_reference IS NOT NULL
    AND t.type = 'credit'
    AND NOT EXISTS (
      SELECT 1 FROM public.paystack_webhook_events w WHERE w.paystack_reference = t.paystack_reference
    );
$$;

-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.get_unmatched_webhooks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_duplicate_transactions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_orphaned_transactions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reconciliation_summary() TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Reconciliation Functions: Created successfully';
  RAISE NOTICE '📊 Functions available: get_unmatched_webhooks, get_duplicate_transactions, get_orphaned_transactions, get_reconciliation_summary';
END $$;
