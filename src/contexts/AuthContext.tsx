import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { rateLimiter } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import type { AppRole } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string, role: AppRole) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Fetch profile when user logs in
        if (session?.user) {
          setTimeout(async () => {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (data) setProfile(data);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: AppRole
  ) => {
    try {
      // Rate limiting check
      const rateLimitCheck = rateLimiter.check(email, 'signup');
      if (!rateLimitCheck.allowed) {
        const message = `Too many signup attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`;
        toast({
          variant: 'destructive',
          title: 'Rate limit exceeded',
          description: message,
        });
        logger.warn('Signup rate limit exceeded', { email });
        return { error: { message } as AuthError };
      }

      const redirectUrl = `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role,
          },
        },
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Sign up failed',
          description: error.message,
        });
        logger.error('Signup failed', error, { email, role });
        return { error };
      }

      // Success: reset rate limit
      rateLimiter.reset(email, 'signup');
      logger.info('User signed up successfully', { email, role });

      toast({
        title: 'Success!',
        description: 'Please check your email to confirm your account.',
      });

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        variant: 'destructive',
        title: 'Sign up failed',
        description: authError.message,
      });
      logger.error('Signup exception', authError);
      return { error: authError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Rate limiting check
      const rateLimitCheck = rateLimiter.check(email, 'login');
      if (!rateLimitCheck.allowed) {
        const message = `Too many login attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`;
        toast({
          variant: 'destructive',
          title: 'Rate limit exceeded',
          description: message,
        });
        logger.warn('Login rate limit exceeded', { email });
        return { error: { message } as AuthError };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Sign in failed',
          description: error.message,
        });
        logger.error('Sign in failed', error, { email });
        return { error };
      }

      // Success: reset rate limit
      rateLimiter.reset(email, 'login');

      // Fetch user role for redirect (without console.logs)
      if (data.user) {
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (roleData?.role) {
          logger.info('User signed in successfully', { 
            userId: data.user.id, 
            role: roleData.role 
          });
          
          setTimeout(() => {
            window.location.href = `/dashboard/${roleData.role}`;
          }, 500);
        } else {
          logger.error('Role not found for user', roleError, { 
            userId: data.user.id 
          });
          
          toast({
            variant: 'destructive',
            title: 'Role not found',
            description: 'Your account role is not set. Please contact support.',
          });
          
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        }
      }

      toast({
        title: 'Welcome back!',
        description: 'Successfully signed in.',
      });

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: authError.message,
      });
      logger.error('Sign in exception', authError);
      return { error: authError };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: 'Signed out',
      description: 'You have been signed out successfully.',
    });
  };

  const resetPassword = async (email: string) => {
    try {
      // Rate limiting check
      const rateLimitCheck = rateLimiter.check(email, 'resetPassword');
      if (!rateLimitCheck.allowed) {
        const message = `Too many reset attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`;
        toast({
          variant: 'destructive',
          title: 'Rate limit exceeded',
          description: message,
        });
        logger.warn('Password reset rate limit exceeded', { email });
        return { error: { message } as AuthError };
      }

      const redirectUrl = `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Password reset failed',
          description: error.message,
        });
        logger.error('Password reset failed', error, { email });
        return { error };
      }

      // Success: reset rate limit
      rateLimiter.reset(email, 'resetPassword');
      logger.info('Password reset email sent', { email });

      toast({
        title: 'Check your email',
        description: 'Password reset link has been sent to your email.',
      });

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      logger.error('Password reset exception', authError);
      return { error: authError };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
