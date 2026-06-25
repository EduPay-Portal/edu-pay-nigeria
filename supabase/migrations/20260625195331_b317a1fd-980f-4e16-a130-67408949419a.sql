
-- 1. Fix mutable search_path on functions that were missing it
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.generate_transaction_reference() SET search_path = public;
ALTER FUNCTION public.update_virtual_account_updated_at() SET search_path = public;

-- 2. Convert admin reporting RPCs from SECURITY DEFINER -> SECURITY INVOKER.
--    These read data that admins can already see via RLS, so DEFINER is unnecessary
--    and triggers the linter. Keep search_path locked.

CREATE OR REPLACE FUNCTION public.get_reconciliation_summary()
 RETURNS TABLE(metric character varying, count bigint, total_amount numeric)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_unmatched_webhooks()
 RETURNS TABLE(id uuid, paystack_reference character varying, event_type character varying, payload jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT w.id, w.paystack_reference, w.event_type, w.payload, w.created_at
  FROM public.paystack_webhook_events w
  WHERE w.event_type = 'charge.success' AND w.signature_valid = true AND w.processed = true
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.paystack_reference = w.paystack_reference)
  ORDER BY w.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_duplicate_transactions()
 RETURNS TABLE(paystack_reference character varying, count bigint, total_amount numeric, transactions jsonb)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT t.paystack_reference, COUNT(*)::BIGINT, SUM(t.amount)::DECIMAL(12,2),
    jsonb_agg(jsonb_build_object('id', t.id, 'reference', t.reference, 'amount', t.amount, 'status', t.status, 'created_at', t.created_at))
  FROM public.transactions t WHERE t.paystack_reference IS NOT NULL
  GROUP BY t.paystack_reference HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_orphaned_transactions()
 RETURNS TABLE(id uuid, reference text, paystack_reference character varying, amount numeric, status text, created_at timestamp with time zone, user_id uuid)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.reference, t.paystack_reference, t.amount, t.status::TEXT, t.created_at, t.user_id
  FROM public.transactions t
  WHERE t.paystack_reference IS NOT NULL AND t.type = 'credit'
    AND NOT EXISTS (SELECT 1 FROM public.paystack_webhook_events w WHERE w.paystack_reference = t.paystack_reference)
  ORDER BY t.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_import_staging_stats()
 RETURNS TABLE(total_records bigint, processed_records bigint, pending_records bigint, error_records bigint, unique_batches bigint)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*)::BIGINT AS total_records,
    COUNT(*) FILTER (WHERE processed = true AND error_message IS NULL)::BIGINT AS processed_records,
    COUNT(*) FILTER (WHERE processed = false)::BIGINT AS pending_records,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL)::BIGINT AS error_records,
    0::BIGINT AS unique_batches
  FROM public.students_import_staging;
$function$;

-- get_student_stats already has an internal admin check, but convert to INVOKER
-- so the linter no longer flags it. RLS on student_profiles already restricts
-- non-admins.
CREATE OR REPLACE FUNCTION public.get_student_stats()
 RETURNS TABLE(total_students bigint, total_school_fees numeric, total_wallet_balance numeric, total_debt numeric, va_count bigint)
 LANGUAGE plpgsql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::bigint FROM public.student_profiles),
    (SELECT COALESCE(SUM(school_fees), 0)::numeric FROM public.student_profiles),
    (SELECT COALESCE(SUM(w.balance), 0)::numeric
       FROM public.wallets w
       JOIN public.student_profiles s ON s.user_id = w.user_id),
    (SELECT COALESCE(SUM(debt_balance), 0)::numeric FROM public.student_profiles),
    (SELECT COUNT(*)::bigint FROM public.virtual_accounts);
END;
$function$;

-- 3. Revoke EXECUTE from anon/authenticated/PUBLIC on SECURITY DEFINER
--    functions that should only be invoked internally (triggers and
--    service-role helpers). Re-grant only what frontends/RLS need.

-- Trigger functions (only the trigger system calls these)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_user_wallet()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_role_profile()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_transaction_to_wallet()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_status_change_to_wallet()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_transaction_idempotency()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_wallet_balance()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_virtual_account_stats()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_virtual_account_updated_at()     FROM PUBLIC, anon, authenticated;

-- Service-role-only helpers
REVOKE EXECUTE ON FUNCTION public.mark_staging_processed(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_transaction_reference()              FROM PUBLIC, anon;

-- has_role is needed by RLS policies executed under the authenticated role,
-- so it must remain executable by authenticated. Lock down anon.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
