-- Reset bulk import staging table for re-processing
-- Run this before re-running the bulk import with the fixed Edge Function

-- Step 1: Reset all staging records to unprocessed
UPDATE public.students_import_staging
SET 
  processed = false,
  error_message = null,
  student_id = null,
  parent_id = null;

-- Step 2: (Optional) Clean up any incomplete auth users created during failed imports
-- Only run this if you want to delete ALL previously created students/parents
-- WARNING: This will delete users and cascade to profiles, wallets, transactions
-- Uncomment the lines below if you want to start completely fresh:

-- DELETE FROM auth.users 
-- WHERE email LIKE '%@edupay.school' 
-- AND created_at > '2024-01-01'; -- Adjust date as needed

-- DELETE FROM auth.users
-- WHERE email IN (
--   SELECT DISTINCT parent_email 
--   FROM public.students_import_staging
-- )
-- AND created_at > '2024-01-01'; -- Adjust date as needed

-- Step 3: Verify the reset
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE processed = false) as unprocessed,
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) as with_errors
FROM public.students_import_staging;
