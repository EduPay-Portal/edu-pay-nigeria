-- =====================================================
-- Auto Virtual Account Creation on Student Registration
-- =====================================================
-- Creates a trigger to automatically create Paystack virtual accounts
-- when new students are registered

-- =====================================================
-- 1. ENABLE PG_NET EXTENSION
-- =====================================================
-- pg_net is required for making HTTP requests from database triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- 2. CREATE FUNCTION TO CALL CREATE-VIRTUAL-ACCOUNT EDGE FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_virtual_account_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_service_role_key TEXT;
  v_supabase_url TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get the profile information for the newly created student
  SELECT 
    p.first_name,
    p.last_name,
    p.email
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  -- Get Supabase credentials from environment
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);

  -- Only proceed if profile exists and has required fields
  IF v_profile IS NOT NULL AND v_profile.email IS NOT NULL THEN
    -- Make async HTTP request to create-virtual-account edge function
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/create-virtual-account',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'student_id', NEW.user_id,
        'first_name', v_profile.first_name,
        'last_name', v_profile.last_name,
        'email', v_profile.email
      )
    ) INTO v_request_id;

    -- Log the request (for debugging)
    RAISE NOTICE 'Virtual account creation triggered for student %. Request ID: %', 
      NEW.user_id, v_request_id;
  ELSE
    RAISE WARNING 'Cannot create virtual account for student %: Missing profile or email', 
      NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 3. CREATE TRIGGER ON STUDENT_PROFILES
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_create_virtual_account ON public.student_profiles;

CREATE TRIGGER trigger_auto_create_virtual_account
  AFTER INSERT ON public.student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_virtual_account_creation();

-- =====================================================
-- 4. GRANT PERMISSIONS
-- =====================================================
-- Grant pg_net usage to authenticated users (for edge function calls)
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Auto Virtual Account Creation: Trigger installed successfully';
  RAISE NOTICE '📝 New student profiles will automatically trigger virtual account creation';
  RAISE NOTICE '⚠️  Note: Requires SUPABASE_URL and service role key to be configured';
END $$;
