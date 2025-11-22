import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface VirtualAccount {
  id: string;
  student_id: string;
  paystack_customer_code: string;
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
