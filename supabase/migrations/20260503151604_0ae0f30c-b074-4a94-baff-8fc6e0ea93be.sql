-- Drop and recreate staging table with the canonical CSV column names
DROP TABLE IF EXISTS public.students_import_staging CASCADE;

CREATE TABLE public.students_import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "SN" TEXT,
  "SURNAME" TEXT,
  "NAMES" TEXT,
  "CLASS" TEXT,
  "REG NO" TEXT,
  "MEMBER/NMEMBER" TEXT,
  "DAY/BOARDER" TEXT,
  "SCHOOL FEES" TEXT,
  "DEBTS" TEXT,
  parent_email TEXT,
  parent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.students_import_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read staging records" ON public.students_import_staging FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert staging records" ON public.students_import_staging FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update staging records" ON public.students_import_staging FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete staging records" ON public.students_import_staging FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_staging_processed ON public.students_import_staging(processed);
CREATE INDEX idx_staging_parent_email ON public.students_import_staging(parent_email);

-- Add missing student profile columns referenced by UI
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS school_fees DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS debt_balance DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS membership_status TEXT CHECK (membership_status IS NULL OR membership_status IN ('MEMBER','NMEMBER')),
  ADD COLUMN IF NOT EXISTS boarding_status TEXT CHECK (boarding_status IS NULL OR boarding_status IN ('DAY','BOARDER')),
  ADD COLUMN IF NOT EXISTS registration_number TEXT;