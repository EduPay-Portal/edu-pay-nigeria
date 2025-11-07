-- =====================================================
-- EduPay Connect - Database Setup Script
-- =====================================================
-- Run this script in Supabase SQL Editor after project creation
-- This creates all necessary tables, RLS policies, and triggers

-- Create app_role enum type
CREATE TYPE public.app_role AS ENUM ('student', 'parent', 'admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (CRITICAL: Separate table prevents privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policy: Users can read their own roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Admins can read all roles
CREATE POLICY "Admins can read all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.email
  );

  -- Insert role from metadata
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'role')::public.app_role
  );

  RETURN NEW;
END;
$$;

-- Trigger to call handle_new_user on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to update updated_at on profiles
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Additional Tables for EduPay Features
-- =====================================================

-- Create notification preference enum
CREATE TYPE public.notification_preference AS ENUM ('sms', 'email', 'both');

-- Create transaction enums
CREATE TYPE public.transaction_type AS ENUM ('credit', 'debit');
CREATE TYPE public.transaction_category AS ENUM ('fee_payment', 'wallet_topup', 'canteen', 'books', 'transport', 'other');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed', 'reversed');

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0.00 CHECK (balance >= 0),
  currency TEXT DEFAULT 'NGN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  type public.transaction_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  category public.transaction_category NOT NULL,
  description TEXT,
  reference TEXT UNIQUE NOT NULL,
  status public.transaction_status DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create student_profiles table
CREATE TABLE public.student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  admission_number TEXT UNIQUE NOT NULL,
  class_level TEXT NOT NULL,
  section TEXT,
  parent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on student_profiles
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- Create parent_profiles table
CREATE TABLE public.parent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  occupation TEXT,
  notification_preference public.notification_preference DEFAULT 'email',
  emergency_contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on parent_profiles
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;

-- Create admin_profiles table
CREATE TABLE public.admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  department TEXT,
  access_level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on admin_profiles
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for Wallets
-- =====================================================

-- Users can read their own wallet
CREATE POLICY "Users can read own wallet"
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all wallets
CREATE POLICY "Admins can read all wallets"
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all wallets
CREATE POLICY "Admins can update all wallets"
  ON public.wallets
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- RLS Policies for Transactions
-- =====================================================

-- Users can read their own transactions
CREATE POLICY "Users can read own transactions"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all transactions
CREATE POLICY "Admins can read all transactions"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert transactions
CREATE POLICY "Admins can insert transactions"
  ON public.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update transactions
CREATE POLICY "Admins can update transactions"
  ON public.transactions
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Parents can read their children's transactions
CREATE POLICY "Parents can read children transactions"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.user_id = transactions.user_id
        AND sp.parent_id = auth.uid()
    )
  );

-- =====================================================
-- RLS Policies for Student Profiles
-- =====================================================

-- Students can read their own profile
CREATE POLICY "Students can read own profile"
  ON public.student_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all student profiles
CREATE POLICY "Admins can read all student profiles"
  ON public.student_profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert student profiles
CREATE POLICY "Admins can insert student profiles"
  ON public.student_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update student profiles
CREATE POLICY "Admins can update student profiles"
  ON public.student_profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Parents can read their children's profiles
CREATE POLICY "Parents can read children profiles"
  ON public.student_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = parent_id);

-- =====================================================
-- RLS Policies for Parent Profiles
-- =====================================================

-- Parents can read their own profile
CREATE POLICY "Parents can read own profile"
  ON public.parent_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all parent profiles
CREATE POLICY "Admins can read all parent profiles"
  ON public.parent_profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert parent profiles
CREATE POLICY "Admins can insert parent profiles"
  ON public.parent_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update parent profiles
CREATE POLICY "Admins can update parent profiles"
  ON public.parent_profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- RLS Policies for Admin Profiles
-- =====================================================

-- Admins can read their own profile
CREATE POLICY "Admins can read own admin profile"
  ON public.admin_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all admin profiles
CREATE POLICY "Admins can read all admin profiles"
  ON public.admin_profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update their own profile
CREATE POLICY "Admins can update own admin profile"
  ON public.admin_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to create wallet on user creation
CREATE OR REPLACE FUNCTION public.create_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create wallet for students and parents
  IF NEW.raw_user_meta_data->>'role' IN ('student', 'parent') THEN
    INSERT INTO public.wallets (user_id, balance, currency)
    VALUES (NEW.id, 0.00, 'NGN');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to create wallet on user signup
CREATE TRIGGER on_user_wallet_creation
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_wallet();

-- Function to create role-specific profile
CREATE OR REPLACE FUNCTION public.create_role_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create student profile
  IF NEW.role = 'student' THEN
    INSERT INTO public.student_profiles (user_id, admission_number, class_level)
    VALUES (
      NEW.user_id,
      'ADM-' || LPAD(nextval('student_admission_seq')::TEXT, 6, '0'),
      'Not Assigned'
    );
  END IF;

  -- Create parent profile
  IF NEW.role = 'parent' THEN
    INSERT INTO public.parent_profiles (user_id)
    VALUES (NEW.user_id);
  END IF;

  -- Create admin profile
  IF NEW.role = 'admin' THEN
    INSERT INTO public.admin_profiles (user_id)
    VALUES (NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Create sequence for admission numbers
CREATE SEQUENCE IF NOT EXISTS student_admission_seq START 1000;

-- Trigger to create role-specific profile
CREATE TRIGGER on_role_profile_creation
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_role_profile();

-- Function to update wallet balance on transaction completion
CREATE OR REPLACE FUNCTION public.update_wallet_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if transaction is being marked as completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NEW.type = 'credit' THEN
      UPDATE public.wallets
      SET balance = balance + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.wallet_id;
    ELSIF NEW.type = 'debit' THEN
      UPDATE public.wallets
      SET balance = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.wallet_id;
    END IF;
  END IF;

  -- Handle reversal
  IF NEW.status = 'reversed' AND OLD.status = 'completed' THEN
    IF NEW.type = 'credit' THEN
      UPDATE public.wallets
      SET balance = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.wallet_id;
    ELSIF NEW.type = 'debit' THEN
      UPDATE public.wallets
      SET balance = balance + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.wallet_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to update wallet balance
CREATE TRIGGER on_transaction_wallet_update
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wallet_balance();

-- Function to generate transaction reference
CREATE OR REPLACE FUNCTION public.generate_transaction_reference()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  ref TEXT;
BEGIN
  ref := 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('transaction_ref_seq')::TEXT, 6, '0');
  RETURN ref;
END;
$$;

-- Create sequence for transaction references
CREATE SEQUENCE IF NOT EXISTS transaction_ref_seq START 1000;

-- Trigger to set updated_at on student_profiles
CREATE TRIGGER set_student_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to set updated_at on parent_profiles
CREATE TRIGGER set_parent_updated_at
  BEFORE UPDATE ON public.parent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to set updated_at on admin_profiles
CREATE TRIGGER set_admin_updated_at
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to set updated_at on wallets
CREATE TRIGGER set_wallet_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- PHASE 0: CRITICAL SECURITY INDEXES & CONSTRAINTS
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Wallets indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_balance ON public.wallets(balance DESC);

-- Transactions indexes (CRITICAL for performance)
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

-- =====================================================
-- IDEMPOTENCY FOR TRANSACTIONS (Prevent Duplicates)
-- =====================================================

-- Add idempotency_key column to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE;

-- Create index on idempotency_key
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON public.transactions(idempotency_key);

-- Function to prevent duplicate transactions
CREATE OR REPLACE FUNCTION public.check_transaction_idempotency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.idempotency_key IS NOT NULL THEN
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

-- Trigger for idempotency check
DROP TRIGGER IF EXISTS enforce_transaction_idempotency ON public.transactions;
CREATE TRIGGER enforce_transaction_idempotency
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transaction_idempotency();

-- =====================================================
-- BALANCE VALIDATION (Prevent Negative Balances)
-- =====================================================

-- Function to validate wallet balance never goes negative
CREATE OR REPLACE FUNCTION public.validate_wallet_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'Insufficient funds. Wallet balance cannot be negative. Current balance: ₦%, Attempted balance: ₦%', 
      OLD.balance, NEW.balance;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for balance validation
DROP TRIGGER IF EXISTS check_wallet_balance_before_update ON public.wallets;
CREATE TRIGGER check_wallet_balance_before_update
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  WHEN (NEW.balance IS DISTINCT FROM OLD.balance)
  EXECUTE FUNCTION public.validate_wallet_balance();

-- =====================================================
-- Setup Complete!
-- =====================================================
-- Phase 0 Security Features Added:
-- ✅ Performance indexes on all critical tables
-- ✅ Idempotency enforcement for transactions
-- ✅ Negative balance prevention
-- 
-- Next steps:
-- 1. Run this script in Supabase SQL Editor
-- 2. Configure Auth URLs in Supabase Dashboard
-- 3. Add environment variables to your app
-- 4. Test signup/login flows
-- See SUPABASE_SETUP.md for detailed instructions
