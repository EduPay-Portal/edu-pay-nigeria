CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.has_role(_uid,'admin') OR private.has_role(_uid,'principal') OR private.has_role(_uid,'bursar')
      OR private.has_role(_uid,'registrar') OR private.has_role(_uid,'auditor');
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_student_stats()
 RETURNS TABLE(total_students bigint, total_school_fees numeric, total_wallet_balance numeric, total_debt numeric, va_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: staff role required';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::bigint FROM public.student_profiles),
    (SELECT COALESCE(SUM(school_fees), 0)::numeric FROM public.student_profiles),
    (SELECT COALESCE(SUM(w.balance), 0)::numeric FROM public.wallets w JOIN public.student_profiles s ON s.user_id = w.user_id),
    (SELECT COALESCE(SUM(debt_balance), 0)::numeric FROM public.student_profiles),
    (SELECT COUNT(*)::bigint FROM public.virtual_accounts WHERE status = 'active');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_student_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_simulated_transaction(_reference text, _paystack_reference text, _metadata jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(_reference,'') LIKE 'TEST\_%' OR COALESCE(_paystack_reference,'') LIKE 'TEST\_%'
      OR COALESCE(_metadata->>'simulation','') = 'true' OR COALESCE(_metadata->>'simulated','') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.get_live_inflow_summary(_since timestamptz DEFAULT date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos')
RETURNS TABLE(live_count bigint, live_amount numeric, today_count bigint, today_amount numeric, simulated_count bigint, simulated_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: staff role required';
  END IF;
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE NOT sim)::bigint,
    COALESCE(SUM(amount) FILTER (WHERE NOT sim),0)::numeric,
    COUNT(*) FILTER (WHERE NOT sim AND created_at >= _since)::bigint,
    COALESCE(SUM(amount) FILTER (WHERE NOT sim AND created_at >= _since),0)::numeric,
    COUNT(*) FILTER (WHERE sim)::bigint,
    COALESCE(SUM(amount) FILTER (WHERE sim),0)::numeric
  FROM (
    SELECT t.amount, t.created_at, public.is_simulated_transaction(t.reference, t.paystack_reference, t.metadata) AS sim
    FROM public.transactions t
    WHERE t.status = 'completed' AND t.type = 'credit' AND t.settlement_id IS NULL
  ) x;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_live_inflow_summary(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_inflow_summary(timestamptz) TO authenticated;