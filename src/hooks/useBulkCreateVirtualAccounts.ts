import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkCreationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
}

interface BulkCreationError {
  student_id: string;
  error: string;
}

export function useBulkCreateVirtualAccounts() {
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<BulkCreationProgress>({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
  });
  const [errors, setErrors] = useState<BulkCreationError[]>([]);

  const startBulkCreation = async () => {
    setIsCreating(true);
    setProgress({ total: 0, processed: 0, successful: 0, failed: 0 });
    setErrors([]);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-create-virtual-accounts', {
        body: {},
      });

      if (error) throw error;

      const result = data as {
        total: number;
        successful: number;
        failed: number;
        errors?: BulkCreationError[];
      };

      setProgress({
        total: result.total,
        processed: result.total,
        successful: result.successful,
        failed: result.failed,
      });

      if (result.errors && result.errors.length > 0) {
        setErrors(result.errors);
      }

      if (result.successful > 0) {
        toast.success(`Successfully created ${result.successful} virtual accounts!`);
      }

      if (result.failed > 0) {
        toast.error(`${result.failed} virtual accounts failed to create. Check details below.`);
      }

      return result;
    } catch (error) {
      console.error('Error creating virtual accounts:', error);
      toast.error('Failed to create virtual accounts. Please try again.');
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    progress,
    errors,
    startBulkCreation,
  };
}
