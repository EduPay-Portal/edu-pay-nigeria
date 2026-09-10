ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS bvn text,
  ADD COLUMN IF NOT EXISTS nin text,
  ADD COLUMN IF NOT EXISTS phone text;