import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateVirtualAccountParams {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

async function getFunctionErrorMessage(error: unknown): Promise<{ message: string; requestId?: string }> {
  const fallback = error instanceof Error ? error.message : 'Failed to create virtual account.';

  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      return {
        message: payload?.message || payload?.error || fallback,
        requestId: payload?.request_id,
      };
    } catch {
      return { message: fallback };
    }
  }

  return { message: fallback };
}

export function useCreateVirtualAccount() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: CreateVirtualAccountParams) => {
      const { data, error } = await supabase.functions.invoke('create-virtual-account', {
        body: params,
      });

      if (error) {
        const details = await getFunctionErrorMessage(error);
        const friendlyError = new Error(details.message);
        (friendlyError as Error & { requestId?: string }).requestId = details.requestId;
        throw friendlyError;
      }
      if (data?.error) {
        const friendlyError = new Error(data.message || data.error);
        (friendlyError as Error & { requestId?: string }).requestId = data.request_id;
        throw friendlyError;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['virtual-account', variables.student_id] });
      toast.success('Virtual account created successfully!');
    },
    onError: (error: Error & { requestId?: string }) => {
      console.error('Error creating virtual account:', error);
      toast.error(error.requestId ? `${error.message} (Request ID: ${error.requestId})` : error.message);
    },
  });

  return {
    createAccount: mutation.mutate,
    createAccountAsync: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
