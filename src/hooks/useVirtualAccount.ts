import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface VirtualAccount {
  id: string;
  student_id: string;
  provider: string | null;
  provider_customer_id: string | null;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  is_active: boolean;
  total_received: number;
  last_payment_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VirtualAccountProvisioningJob {
  id: string;
  student_id: string;
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  request_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function useVirtualAccount(studentId?: string) {
  const { user } = useAuth();
  const targetUserId = studentId || user?.id;

  return useQuery({
    queryKey: ['virtual-account', targetUserId],
    queryFn: async () => {
      if (!targetUserId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('*')
        .eq('student_id', targetUserId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data as VirtualAccount;
    },
    enabled: !!targetUserId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useVirtualAccountProvisioningJob(studentId?: string) {
  const { user } = useAuth();
  const targetUserId = studentId || user?.id;

  return useQuery({
    queryKey: ['virtual-account-provisioning-job', targetUserId],
    queryFn: async () => {
      if (!targetUserId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('virtual_account_provisioning_jobs')
        .select('id, student_id, provider, status, attempts, request_id, last_error, created_at, updated_at')
        .eq('student_id', targetUserId)
        .eq('provider', 'wema')
        .maybeSingle();

      if (error) throw error;
      return data as VirtualAccountProvisioningJob | null;
    },
    enabled: !!targetUserId,
    staleTime: 60 * 1000,
    refetchInterval: (query) => {
      const status = (query.state.data as VirtualAccountProvisioningJob | null | undefined)?.status;
      return status === 'pending' || status === 'processing' ? 15000 : false;
    },
  });
}
