-- Fix RLS policies for student_profiles and parent_profiles to allow admin access
-- This migration ensures admins can view all student and parent data

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all student profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Students can view their own profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Parents can view their children's profiles" ON public.student_profiles;

DROP POLICY IF EXISTS "Admins can view all parent profiles" ON public.parent_profiles;
DROP POLICY IF EXISTS "Parents can view their own profile" ON public.parent_profiles;

-- Enable RLS on student_profiles
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on parent_profiles
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;

-- Student Profiles RLS Policies
-- Allow admins to view all student profiles
CREATE POLICY "Admins can view all student profiles"
  ON public.student_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Allow students to view their own profile
CREATE POLICY "Students can view their own profile"
  ON public.student_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow parents to view their children's profiles
CREATE POLICY "Parents can view their children's profiles"
  ON public.student_profiles
  FOR SELECT
  TO authenticated
  USING (
    parent_id IN (
      SELECT id FROM public.parent_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Parent Profiles RLS Policies
-- Allow admins to view all parent profiles
CREATE POLICY "Admins can view all parent profiles"
  ON public.parent_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Allow parents to view their own profile
CREATE POLICY "Parents can view their own profile"
  ON public.parent_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Grant necessary permissions
GRANT SELECT ON public.student_profiles TO authenticated;
GRANT SELECT ON public.parent_profiles TO authenticated;
