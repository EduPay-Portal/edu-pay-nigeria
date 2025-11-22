-- =====================================================
-- Bulk Import Infrastructure - Phase 1
-- Migration: 004_bulk_import_infrastructure
-- Purpose: Add bulk student import staging table and tracking columns
-- Date: 2025-11-22
-- =====================================================

BEGIN;

-- =====================================================
-- 1. BULK IMPORT STAGING TABLE
-- =====================================================
-- This table stores the imported CSV data before processing

CREATE TABLE IF NOT EXISTS public.students_import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sn INTEGER,
  names TEXT,
  surname TEXT,
  class_level TEXT,
  reg_no TEXT,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  debt DECIMAL(10,2) DEFAULT 0.00,
  is_member BOOLEAN DEFAULT false,
  is_boarder BOOLEAN DEFAULT false,
  
  -- Processing status
  student_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  
  -- Audit
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Metadata
  import_batch_id UUID DEFAULT gen_random_uuid(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.students_import_staging ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staging_processed ON public.students_import_staging(processed);
CREATE INDEX IF NOT EXISTS idx_staging_batch_id ON public.students_import_staging(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_staging_student_uuid ON public.students_import_staging(student_uuid);
CREATE INDEX IF NOT EXISTS idx_staging_parent_email ON public.students_import_staging(parent_email);

-- =====================================================
-- 2. ENHANCE STUDENT_PROFILES TABLE
-- =====================================================
-- Add import tracking columns

ALTER TABLE public.student_profiles 
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS created_from_import BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_notes TEXT,
  ADD COLUMN IF NOT EXISTS debt DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_member BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_boarder BOOLEAN DEFAULT false;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_student_profiles_import_batch ON public.student_profiles(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_created_from_import ON public.student_profiles(created_from_import);

-- =====================================================
-- 3. ENHANCE PARENT_PROFILES TABLE
-- =====================================================
-- Add import tracking column

ALTER TABLE public.parent_profiles
  ADD COLUMN IF NOT EXISTS created_from_import BOOLEAN DEFAULT false;

-- =====================================================
-- 4. RLS POLICIES FOR STAGING TABLE
-- =====================================================

-- Admins can read all staging records
CREATE POLICY "Admins can read staging records"
  ON public.students_import_staging FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert staging records
CREATE POLICY "Admins can insert staging records"
  ON public.students_import_staging FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update staging records
CREATE POLICY "Admins can update staging records"
  ON public.students_import_staging FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete staging records
CREATE POLICY "Admins can delete staging records"
  ON public.students_import_staging FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to get staging table stats
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
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE processed = true AND processing_error IS NULL) as processed_records,
    COUNT(*) FILTER (WHERE processed = false) as pending_records,
    COUNT(*) FILTER (WHERE processing_error IS NOT NULL) as error_records,
    COUNT(DISTINCT import_batch_id) as unique_batches
  FROM public.students_import_staging;
$$;

-- Function to mark staging record as processed
CREATE OR REPLACE FUNCTION public.mark_staging_processed(
  staging_id UUID,
  s_uuid UUID,
  p_uuid UUID DEFAULT NULL,
  error_msg TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.students_import_staging
  SET 
    processed = (error_msg IS NULL),
    student_uuid = s_uuid,
    parent_uuid = p_uuid,
    processing_error = error_msg,
    processed_at = NOW()
  WHERE id = staging_id;
END;
$$;

COMMIT;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Bulk Import Infrastructure Migration Complete!';
  RAISE NOTICE '=================================================';
  
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ students_import_staging';
  
  RAISE NOTICE 'Columns added:';
  RAISE NOTICE '  ✓ student_profiles: import_batch_id, created_from_import, import_notes, debt, is_member, is_boarder';
  RAISE NOTICE '  ✓ parent_profiles: created_from_import';
  
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  ✓ get_import_staging_stats()';
  RAISE NOTICE '  ✓ mark_staging_processed()';
  
  RAISE NOTICE '=================================================';
END $$;
