-- Migration to populate derived columns in students_import_staging
-- Run this after importing CSV data to prepare for bulk processing

-- Update parent_email (generated from surname)
UPDATE public.students_import_staging
SET parent_email = LOWER("SURNAME") || '.parent@edupay.school'
WHERE parent_email IS NULL OR parent_email = '';

-- Update parent_name (generated from surname)
UPDATE public.students_import_staging
SET parent_name = "SURNAME" || ' Family'
WHERE parent_name IS NULL OR parent_name = '';

-- Update parent_phone (placeholder for now)
UPDATE public.students_import_staging
SET parent_phone = '0800000000'
WHERE parent_phone IS NULL OR parent_phone = '';

-- Update import_batch_id (generate if missing)
UPDATE public.students_import_staging
SET import_batch_id = 'BATCH-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS')
WHERE import_batch_id IS NULL OR import_batch_id = '';

-- Verify the update
SELECT 
  COUNT(*) as total_records,
  COUNT(parent_email) as records_with_email,
  COUNT(parent_name) as records_with_parent_name,
  COUNT(CASE WHEN processed = false THEN 1 END) as pending_records
FROM public.students_import_staging;
