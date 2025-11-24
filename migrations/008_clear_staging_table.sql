-- Clear all staging records to prepare for fresh import
-- Run this in Supabase SQL Editor before re-uploading CSV

-- Option 1: Delete all staging records (recommended for clean start)
DELETE FROM public.students_import_staging;

-- Option 2: Just reset to unprocessed (uncomment if you prefer to keep records)
-- UPDATE public.students_import_staging
-- SET 
--   processed = false,
--   error_message = null,
--   student_id = null,
--   parent_id = null;

-- Verify the table is cleared
SELECT COUNT(*) as remaining_records FROM public.students_import_staging;
