CREATE OR REPLACE FUNCTION public.get_import_staging_stats()
RETURNS TABLE (
  total_records BIGINT,
  processed_records BIGINT,
  pending_records BIGINT,
  error_records BIGINT,
  unique_batches BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT AS total_records,
    COUNT(*) FILTER (WHERE processed = true AND error_message IS NULL)::BIGINT AS processed_records,
    COUNT(*) FILTER (WHERE processed = false)::BIGINT AS pending_records,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL)::BIGINT AS error_records,
    0::BIGINT AS unique_batches
  FROM public.students_import_staging;
$$;