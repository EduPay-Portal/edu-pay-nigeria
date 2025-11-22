import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateVirtualAccountParams {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function useCreateVirtualAccount() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: CreateVirtualAccountParams) => {
      const { data, error } = await supabase.functions.invoke('create-virtual-account', {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['virtual-account', variables.student_id] });
      toast.success('Virtual account created successfully!');
    },
    onError: (error: Error) => {
      console.error('Error creating virtual account:', error);
      toast.error('Failed to create virtual account. Please try again.');
    },
  });

  return {
    createAccount: mutation.mutate,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
