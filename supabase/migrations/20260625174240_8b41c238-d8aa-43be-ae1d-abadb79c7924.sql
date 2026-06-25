CREATE OR REPLACE FUNCTION public.get_student_stats()
RETURNS TABLE(total_students bigint, total_school_fees numeric, total_wallet_balance numeric, total_debt numeric, va_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_student_stats() TO authenticated;