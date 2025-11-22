-- =====================================================
-- PHASE 0: CRITICAL SECURITY INDEXES & CONSTRAINTS
-- Migration: 002_phase0_security_improved
-- Purpose: Add performance indexes, transaction idempotency, and balance validation
-- Safe to run multiple times (idempotent)
-- Author: EduPay Connect Security Team
-- Date: 2025-11-22
-- =====================================================

-- Transaction wrapper for atomicity
BEGIN;

-- =====================================================
-- PRE-FLIGHT CHECK
-- Verify if Phase 0 has already been applied
-- =====================================================

DO $$ 
DECLARE
  v_indexes_count INTEGER;
  v_idempotency_exists BOOLEAN;
BEGIN
  -- Count existing Phase 0 indexes
  SELECT COUNT(*) INTO v_indexes_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
    AND indexname IN (
      'idx_profiles_email', 'idx_profiles_created_at',
      'idx_user_roles_user_id', 'idx_user_roles_role',
      'idx_wallets_user_id', 'idx_wallets_balance',
      'idx_transactions_user_id', 'idx_transactions_wallet_id',
      'idx_transactions_reference', 'idx_transactions_status',
      'idx_transactions_created_at', 'idx_transactions_type_status',
      'idx_transactions_category', 'idx_transactions_idempotency'
    );
  
  -- Check if idempotency column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transactions' 
      AND column_name = 'idempotency_key'
  ) INTO v_idempotency_exists;
  
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Phase 0 Pre-Flight Check:';
  RAISE NOTICE 'Existing indexes: % of 14', v_indexes_count;
  RAISE NOTICE 'Idempotency column exists: %', v_idempotency_exists;
  RAISE NOTICE '=================================================';
END $$;

-- =====================================================
-- SECTION 1: PERFORMANCE INDEXES (Query Optimization)
-- =====================================================

RAISE NOTICE 'Creating performance indexes...';

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Wallets indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_balance ON public.wallets(balance DESC);

-- Transactions indexes (CRITICAL for financial query performance)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON public.transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);

-- Student profiles indexes
CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON public.student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_parent_id ON public.student_profiles(parent_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_admission ON public.student_profiles(admission_number);
CREATE INDEX IF NOT EXISTS idx_student_profiles_class ON public.student_profiles(class_level);

-- Parent profiles indexes
CREATE INDEX IF NOT EXISTS idx_parent_profiles_user_id ON public.parent_profiles(user_id);

-- Admin profiles indexes
CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON public.admin_profiles(user_id);

RAISE NOTICE '✓ Performance indexes created';

-- =====================================================
-- SECTION 2: TRANSACTION IDEMPOTENCY (Prevent Duplicates)
-- =====================================================

RAISE NOTICE 'Setting up transaction idempotency...';

-- Add idempotency_key column with UNIQUE constraint (IMPROVED VERSION)
-- This handles the case where column might exist without constraint
DO $$ 
BEGIN
  -- Step 1: Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transactions' 
      AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.transactions 
    ADD COLUMN idempotency_key UUID;
    RAISE NOTICE '  ✓ Added idempotency_key column';
  ELSE
    RAISE NOTICE '  - idempotency_key column already exists';
  END IF;
  
  -- Step 2: Add unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transactions_idempotency_key_unique'
  ) THEN
    ALTER TABLE public.transactions 
    ADD CONSTRAINT transactions_idempotency_key_unique UNIQUE (idempotency_key);
    RAISE NOTICE '  ✓ Added UNIQUE constraint on idempotency_key';
  ELSE
    RAISE NOTICE '  - UNIQUE constraint already exists';
  END IF;
END $$;

-- Create index on idempotency_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON public.transactions(idempotency_key);

-- Function to prevent duplicate transactions
CREATE OR REPLACE FUNCTION public.check_transaction_idempotency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check if idempotency_key is provided
  IF NEW.idempotency_key IS NOT NULL THEN
    -- Check for existing transaction with same key
    IF EXISTS (
      SELECT 1 FROM public.transactions 
      WHERE idempotency_key = NEW.idempotency_key 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Duplicate transaction detected. Idempotency key already used: %', NEW.idempotency_key;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for idempotency check (drop first to ensure clean state)
DROP TRIGGER IF EXISTS enforce_transaction_idempotency ON public.transactions;
CREATE TRIGGER enforce_transaction_idempotency
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transaction_idempotency();

RAISE NOTICE '✓ Transaction idempotency enforced';

-- =====================================================
-- SECTION 3: BALANCE VALIDATION (Prevent Negative Balances)
-- =====================================================

RAISE NOTICE 'Setting up balance validation...';

-- Function to validate wallet balance never goes negative
CREATE OR REPLACE FUNCTION public.validate_wallet_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent negative balances
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'Insufficient funds. Wallet balance cannot be negative. Current balance: ₦%, Attempted balance: ₦%', 
      OLD.balance, NEW.balance;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for balance validation (drop first to ensure clean state)
DROP TRIGGER IF EXISTS check_wallet_balance_before_update ON public.wallets;
CREATE TRIGGER check_wallet_balance_before_update
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  WHEN (NEW.balance IS DISTINCT FROM OLD.balance)
  EXECUTE FUNCTION public.validate_wallet_balance();

RAISE NOTICE '✓ Balance validation active';

-- =====================================================
-- SECTION 4: VERIFICATION QUERIES
-- Run these to confirm successful migration
-- =====================================================

RAISE NOTICE '';
RAISE NOTICE '=================================================';
RAISE NOTICE 'PHASE 0 MIGRATION COMPLETE - VERIFICATION RESULTS';
RAISE NOTICE '=================================================';

-- Verify indexes
DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
  
  RAISE NOTICE 'Total indexes created: % (expected: 21+)', v_index_count;
END $$;

-- Verify idempotency column
DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transactions' 
      AND column_name = 'idempotency_key'
  ) INTO v_column_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transactions_idempotency_key_unique'
  ) INTO v_constraint_exists;
  
  RAISE NOTICE 'Idempotency column exists: %', v_column_exists;
  RAISE NOTICE 'Idempotency UNIQUE constraint exists: %', v_constraint_exists;
END $$;

-- Verify functions
DO $$
DECLARE
  v_function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('check_transaction_idempotency', 'validate_wallet_balance');
  
  RAISE NOTICE 'Security functions created: % (expected: 2)', v_function_count;
END $$;

-- Verify triggers
DO $$
DECLARE
  v_trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgname IN ('enforce_transaction_idempotency', 'check_wallet_balance_before_update');
  
  RAISE NOTICE 'Security triggers created: % (expected: 2)', v_trigger_count;
END $$;

RAISE NOTICE '=================================================';
RAISE NOTICE 'Run the verification queries below to double-check:';
RAISE NOTICE '=================================================';

-- Commit transaction
COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- Copy and run these separately to verify installation
-- =====================================================

-- 1. List all Phase 0 indexes
SELECT 
  schemaname, 
  tablename, 
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 2. Verify idempotency column structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
  AND column_name = 'idempotency_key';

-- 3. Verify UNIQUE constraint
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'transactions_idempotency_key_unique';

-- 4. Verify security functions
SELECT 
  routine_name, 
  routine_type,
  security_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('check_transaction_idempotency', 'validate_wallet_balance');

-- 5. Verify security triggers
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('enforce_transaction_idempotency', 'check_wallet_balance_before_update');

-- 6. Overall Phase 0 health check
SELECT 
  (SELECT COUNT(*) FROM pg_indexes 
   WHERE schemaname = 'public' AND indexname LIKE 'idx_%') as total_indexes,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'transactions' AND column_name = 'idempotency_key') as has_idempotency_column,
  (SELECT COUNT(*) FROM pg_constraint 
   WHERE conname = 'transactions_idempotency_key_unique') as has_unique_constraint,
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public' AND p.proname IN ('check_transaction_idempotency', 'validate_wallet_balance')) as security_functions,
  (SELECT COUNT(*) FROM pg_trigger 
   WHERE tgname IN ('enforce_transaction_idempotency', 'check_wallet_balance_before_update')) as security_triggers;

-- Expected results for health check:
-- total_indexes: 21+ (includes all Phase 0 indexes)
-- has_idempotency_column: 1
-- has_unique_constraint: 1
-- security_functions: 2
-- security_triggers: 2

-- =====================================================
-- FUNCTIONAL TESTS (Run after verification)
-- =====================================================

-- TEST 1: Transaction Idempotency
-- This should work (first transaction)
INSERT INTO public.transactions (
  user_id, 
  wallet_id, 
  amount, 
  type, 
  category, 
  status,
  reference,
  idempotency_key
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM public.wallets LIMIT 1),
  100.00,
  'credit',
  'wallet_topup',
  'pending',
  'TEST-' || gen_random_uuid()::text,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid
);

-- This should FAIL with idempotency error
INSERT INTO public.transactions (
  user_id, 
  wallet_id, 
  amount, 
  type, 
  category, 
  status,
  reference,
  idempotency_key
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM public.wallets LIMIT 1),
  200.00,
  'credit',
  'wallet_topup',
  'pending',
  'TEST-' || gen_random_uuid()::text,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid  -- Same key!
);

-- Clean up test
DELETE FROM public.transactions 
WHERE idempotency_key = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;

-- TEST 2: Negative Balance Prevention
-- This should FAIL with balance validation error
UPDATE public.wallets 
SET balance = -100.00 
WHERE id = (SELECT id FROM public.wallets LIMIT 1);

-- =====================================================
-- ROLLBACK SCRIPT (Use only if you need to undo changes)
-- =====================================================

/*
-- WARNING: This will remove all Phase 0 security features!
-- Only run this if you need to completely rollback the migration

BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS enforce_transaction_idempotency ON public.transactions;
DROP TRIGGER IF EXISTS check_wallet_balance_before_update ON public.wallets;

-- Drop functions
DROP FUNCTION IF EXISTS public.check_transaction_idempotency();
DROP FUNCTION IF EXISTS public.validate_wallet_balance();

-- Remove idempotency column (WARNING: This will lose data!)
ALTER TABLE public.transactions DROP COLUMN IF EXISTS idempotency_key;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_profiles_email;
DROP INDEX IF EXISTS public.idx_profiles_created_at;
DROP INDEX IF EXISTS public.idx_user_roles_user_id;
DROP INDEX IF EXISTS public.idx_user_roles_role;
DROP INDEX IF EXISTS public.idx_wallets_user_id;
DROP INDEX IF EXISTS public.idx_wallets_balance;
DROP INDEX IF EXISTS public.idx_transactions_user_id;
DROP INDEX IF EXISTS public.idx_transactions_wallet_id;
DROP INDEX IF EXISTS public.idx_transactions_reference;
DROP INDEX IF EXISTS public.idx_transactions_status;
DROP INDEX IF EXISTS public.idx_transactions_created_at;
DROP INDEX IF EXISTS public.idx_transactions_type_status;
DROP INDEX IF EXISTS public.idx_transactions_category;
DROP INDEX IF EXISTS public.idx_transactions_idempotency;
DROP INDEX IF EXISTS public.idx_student_profiles_user_id;
DROP INDEX IF EXISTS public.idx_student_profiles_parent_id;
DROP INDEX IF EXISTS public.idx_student_profiles_admission;
DROP INDEX IF EXISTS public.idx_student_profiles_class;
DROP INDEX IF EXISTS public.idx_parent_profiles_user_id;
DROP INDEX IF EXISTS public.idx_admin_profiles_user_id;

COMMIT;

-- After rollback, verify removal
SELECT 
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') as remaining_indexes,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'idempotency_key') as idempotency_column_exists;

-- Expected: remaining_indexes = 0-7 (system indexes only), idempotency_column_exists = 0
*/
