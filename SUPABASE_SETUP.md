# EduPay Connect - Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in project details:
   - **Name**: EduPay Connect
   - **Database Password**: Choose a strong password (save it securely)
   - **Region**: Choose closest to Nigeria (e.g., Africa or Europe)
4. Click "Create new project" and wait for provisioning (~2 minutes)

## Step 2: Get API Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

3. Create a `.env` file in your project root and add:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

⚠️ **IMPORTANT**: Never commit `.env` to version control. It's already in `.gitignore`.

## Step 3: Run Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase/migrations/001_auth_setup.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute the migration

This creates:
- ✅ `app_role` enum (student, parent, admin)
- ✅ `profiles` table with RLS policies
- ✅ `user_roles` table (prevents privilege escalation)
- ✅ `has_role()` security function
- ✅ Automatic profile/role creation trigger
- ✅ Row Level Security policies

## Step 4: Configure Authentication URLs

1. Go to **Authentication** → **URL Configuration**
2. Set the following:

**Site URL**: 
```
https://your-preview-url.lovable.app
```
(Replace with your actual Lovable preview URL or custom domain)

**Redirect URLs** (add all of these):
```
https://your-preview-url.lovable.app/**
https://your-preview-url.lovable.app/auth/**
http://localhost:5173/**
```

If you have a deployed version or custom domain, add those too.

## Step 5: Configure Email Settings (Optional but Recommended)

### For Testing: Disable Email Confirmation
1. Go to **Authentication** → **Providers** → **Email**
2. Under "Email Settings":
   - **Uncheck** "Enable email confirmations"
   - This allows instant signup for testing

### For Production: Customize Email Templates
1. Go to **Authentication** → **Email Templates**
2. Customize the following templates:
   - **Confirm signup**: Welcome message for new users
   - **Magic Link**: (if using passwordless login)
   - **Change Email Address**: Email change confirmation
   - **Reset Password**: Password reset instructions

3. Add your school branding:
   - Logo URL
   - School colors
   - Custom footer text

## Step 6: Test Authentication Flow

### 6.1 Test Signup
1. Go to `/auth` in your app
2. Click "Sign Up" tab
3. Fill in:
   - First Name: Test
   - Last Name: Student
   - Email: test@school.edu.ng
   - Password: Test1234 (min 8 chars, 1 uppercase, 1 number)
   - Role: Student
4. Click "Create Account"
5. If email confirmation is disabled, you'll be logged in immediately
6. If enabled, check your email and click the confirmation link

### 6.2 Verify Database Records
1. Go to **Table Editor** in Supabase
2. Check `auth.users` table - should have your test user
3. Check `profiles` table - should have profile with first_name, last_name
4. Check `user_roles` table - should have role assignment

### 6.3 Test Login
1. Sign out from the app
2. Go to `/auth`
3. Enter email and password
4. Click "Sign In"
5. Should redirect to home page

### 6.4 Test Password Reset
1. On login page, click "Forgot password?"
2. Enter email
3. Click "Send Reset Link"
4. Check email for reset link
5. Click link and set new password

## Step 7: Create First Admin User

After testing basic signup, create an admin user:

### Option A: Through UI (Recommended)
1. Sign up through the app with role "School Administrator"
2. This user will have full admin access

### Option B: Manual SQL (for existing user)
1. Go to **SQL Editor** in Supabase
2. Find the user's ID from `auth.users` table
3. Run:

```sql
-- Update role for existing user (replace user_id)
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = 'user-uuid-here';

-- Or insert new role if doesn't exist
INSERT INTO user_roles (user_id, role)
VALUES ('user-uuid-here', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

## Step 8: Security Checklist

✅ **Environment Variables**: Confirm `.env` is NOT committed to git  
✅ **RLS Enabled**: All tables have Row Level Security enabled  
✅ **Roles Isolated**: User roles stored in separate `user_roles` table  
✅ **Security Definer**: `has_role()` function uses SECURITY DEFINER  
✅ **Redirect URLs**: All deployment URLs added to Supabase  
✅ **Email Templates**: Customized for school branding (optional)  
✅ **Admin User**: At least one admin user created for testing  

## Troubleshooting

### Issue: "Missing Supabase environment variables"
**Solution**: Make sure `.env` file exists in project root with both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Issue: "Invalid login credentials"
**Solutions**:
- Check if email confirmation is required (disable for testing)
- Verify user exists in `auth.users` table
- Try password reset flow

### Issue: "new row violates row-level security policy"
**Solutions**:
- Verify RLS policies are created correctly
- Check if `has_role()` function exists
- Ensure user is authenticated before inserting data

### Issue: "User redirects to localhost:3000 after login"
**Solution**: Add your Lovable preview URL to Redirect URLs in Supabase Authentication settings

### Issue: "infinite recursion detected in policy"
**Solution**: This means you're checking roles inside RLS without using `has_role()` function. Always use the security definer function.

### Issue: Profile/role not created on signup
**Solution**: 
- Check if trigger `on_auth_user_created` exists
- Verify `handle_new_user()` function is created
- Check Supabase logs for trigger errors

## Next Steps

Now that authentication is set up, you can:
1. ✅ Build protected dashboards for each user role
2. ✅ Add student wallet functionality
3. ✅ Integrate payment gateways (Paystack, Flutterwave)
4. ✅ Add SMS notifications (Termii API)
5. ✅ Create admin management features

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Auth Guide**: https://supabase.com/docs/guides/auth
- **RLS Policies**: https://supabase.com/docs/guides/auth/row-level-security
- **EduPay Connect Docs**: See project README.md

---

**Security Note**: This setup implements industry-standard security practices including:
- Separate roles table to prevent privilege escalation
- Row Level Security on all tables
- Security definer functions to prevent RLS recursion
- Proper input validation with Zod
- Session-based authentication with auto-refresh
- No sensitive data logged to console
