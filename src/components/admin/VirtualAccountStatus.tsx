import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useVirtualAccount } from '@/hooks/useVirtualAccount';

interface VirtualAccountStatusProps {
  studentId: string;
}

export function VirtualAccountStatus({ studentId }: VirtualAccountStatusProps) {
  const { data: account, isLoading } = useVirtualAccount(studentId);

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        Loading...
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
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <XCircle className="h-3 w-3" />
      Not Created
    </Badge>
  );
}
