import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useVirtualAccount } from '@/hooks/useVirtualAccount';
import { useCreateVirtualAccount } from '@/hooks/useCreateVirtualAccount';
import { useQueryClient } from '@tanstack/react-query';

interface VirtualAccountStatusProps {
  studentId: string;
  studentName?: string;
  studentEmail?: string;
}

export function VirtualAccountStatus({ studentId, studentName, studentEmail }: VirtualAccountStatusProps) {
  const { data: account, isLoading } = useVirtualAccount(studentId);
  const { createAccountAsync, isCreating } = useCreateVirtualAccount();
  const queryClient = useQueryClient();

  const handleCreateVA = async () => {
    if (!studentName || !studentEmail) return;

    const [firstName, ...lastNameParts] = studentName.split(' ');
    const lastName = lastNameParts.join(' ') || firstName;

    try {
      await createAccountAsync({
        student_id: studentId,
        first_name: firstName,
        last_name: lastName,
        email: studentEmail,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['va-count'] });
    } catch (error) {
      console.error('Failed to create VA:', error);
    }
  };

  if (isLoading || isCreating) {
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        {isCreating ? 'Creating...' : 'Loading...'}
      </Badge>
    );
  }

  if (account && account.is_active) {
    return (
      <Badge variant="default" className="gap-1 bg-success">
        <CheckCircle className="h-3 w-3" />
        Active
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <XCircle className="h-3 w-3" />
        Not Created
      </Badge>
      {studentName && studentEmail && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateVA}
          disabled={isCreating}
        >
          Create VA
        </Button>
      )}
    </div>
  );
}
