import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, CreditCard, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useVirtualAccount, useVirtualAccountProvisioningJob } from '@/hooks/useVirtualAccount';
import { useCreateVirtualAccount } from '@/hooks/useCreateVirtualAccount';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface VirtualAccountCardProps {
  studentId?: string;
  showCreateButton?: boolean;
}

export function VirtualAccountCard({ studentId, showCreateButton = true }: VirtualAccountCardProps) {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  const isAdmin = role === 'admin';
  const { data: account, isLoading, isError, error } = useVirtualAccount(studentId);
  const { data: provisioningJob } = useVirtualAccountProvisioningJob(studentId);
  const { createAccount, isCreating, error: creationError } = useCreateVirtualAccount();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (account?.account_number) {
      await navigator.clipboard.writeText(account.account_number);
      setCopied(true);
      toast.success('Account number copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateAccount = async () => {
    if (!user) return;
    
    createAccount({
      student_id: studentId || user.id,
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      email: user.email || '',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Virtual Account
          </CardTitle>
          <CardDescription>We could not load your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Virtual account unavailable</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Please refresh the page. If this continues, contact the bursary or school administrator.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Virtual Account
          </CardTitle>
          <CardDescription>No virtual account found</CardDescription>
        </CardHeader>
        <CardContent>
          {showCreateButton && isAdmin ? (
            <Button
              onClick={handleCreateAccount}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? 'Creating...' : 'Create Virtual Account'}
            </Button>
          ) : (
            <Alert>
              <AlertTitle>
                {provisioningJob?.status === 'failed'
                  ? 'Virtual account needs administrator review'
                  : 'Virtual account is being set up'}
              </AlertTitle>
              <AlertDescription>
                {provisioningJob?.status === 'failed'
                  ? `Automatic setup failed${provisioningJob.request_id ? ` (Request ID: ${provisioningJob.request_id})` : ''}. Please contact the bursary or school administrator.`
                  : 'Your payment account is created automatically after registration. Please check back shortly; if it is still missing, contact the bursary or school administrator.'}
              </AlertDescription>
            </Alert>
          )}
          {creationError && isAdmin ? (
            <p className="mt-3 text-sm text-destructive">
              {creationError.message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Your Virtual Account
        </CardTitle>
        <CardDescription>Use this account for payments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Account Number</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold font-mono tracking-wider">
              {account.account_number}
            </p>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="h-8 w-8"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Bank Name</p>
          <p className="font-semibold">{account.bank_name}</p>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Account Name</p>
          <p className="font-medium">{account.account_name}</p>
        </div>

        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">
            ℹ️ Transfer to this account to fund your wallet. Payments reflect within 5-30 minutes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
