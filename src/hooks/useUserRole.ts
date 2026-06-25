import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types/auth';

/**
 * Returns the current user's role, or null if the user has none / lookup failed.
 * Never throws — callers (ProtectedRoute) should treat null as "deny".
 */
export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery<AppRole | null>({
    queryKey: ['userRole', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('useUserRole: failed to fetch role', error);
        return null;
      }
      return (data?.role ?? null) as AppRole | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
