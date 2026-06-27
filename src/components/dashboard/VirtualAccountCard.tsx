import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, CreditCard, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useVirtualAccount, useVirtualAccountProvisioningJob } from '@/hooks/useVirtualAccount';
import { useCreateVirtualAccount } from '@/hooks/useCreateVirtualAccount';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface VirtualAccountCardProps {
  studentId?: string;
  showCreateButton?: boolean;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function VirtualAccountCard({ studentId, showCreateButton = true }: VirtualAccountCardProps) {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const { data: account, isLoading, isError, error } = useVirtualAccount(studentId);
  const { data: provisioningJob } = useVirtualAccountProvisioningJob(studentId);
  const { createAccount, isCreating, error: creationError } = useCreateVirtualAccount();
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!provisioningJob?.next_retry_at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [provisioningJob?.next_retry_at]);

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

  const handleAdminRetry = async () => {
    const target = studentId || user?.id;
    if (!target) return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('provision-student-virtual-account', {
        body: { student_id: target, provider: 'wema', force: true },
      });
      if (error) throw error;
      toast.success('Provisioning retry triggered', {
        description: data?.request_id ? `Request ID: ${data.request_id}` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['virtual-account-provisioning-job', target] });
      queryClient.invalidateQueries({ queryKey: ['virtual-account', target] });
    } catch (e) {
      toast.error('Retry failed', {
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setRetrying(false);
    }
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

  const target = studentId || user?.id;
  const auditHref = provisioningJob?.request_id
    ? `/dashboard/admin/audit-logs?request_id=${encodeURIComponent(provisioningJob.request_id)}${target ? `&student_id=${encodeURIComponent(target)}` : ''}`
    : target
      ? `/dashboard/admin/audit-logs?student_id=${encodeURIComponent(target)}`
      : '/dashboard/admin/audit-logs';

  if (!account) {
    const job = provisioningJob;
    const exhausted = !!job && job.attempts >= job.max_attempts;
    const retryMs = job?.next_retry_at ? new Date(job.next_retry_at).getTime() - now : 0;

    let statusTitle = 'Virtual account is being set up';
    let statusBody = 'Your payment account is created automatically after registration. Please check back shortly; if it is still missing, contact the bursary or school administrator.';

    if (job?.status === 'failed' || exhausted) {
      statusTitle = 'Virtual account needs administrator review';
      statusBody = `Automatic setup did not complete${job?.request_id ? ` (Request ID: ${job.request_id})` : ''}. Please contact the bursary or school administrator.`;
    } else if (job?.status === 'processing') {
      statusTitle = 'Setting up your virtual account';
      statusBody = `In progress — attempt ${job.attempts} of ${job.max_attempts}.`;
    } else if (job?.status === 'pending' && job.attempts > 0) {
      statusTitle = 'Retrying virtual account setup';
      statusBody = `Retry ${job.attempts} of ${job.max_attempts}${job.next_retry_at ? ` — next attempt in ${formatCountdown(retryMs)}` : ''}.`;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Virtual Account
          </CardTitle>
          <CardDescription>No virtual account found</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {showCreateButton && isAdmin ? (
            <Button onClick={handleCreateAccount} disabled={isCreating} className="w-full">
              {isCreating ? 'Creating...' : 'Create Virtual Account'}
            </Button>
          ) : (
            <Alert>
              <AlertTitle>{statusTitle}</AlertTitle>
              <AlertDescription>{statusBody}</AlertDescription>
            </Alert>
          )}

          {creationError && isAdmin ? (
            <p className="text-sm text-destructive">{creationError.message}</p>
          ) : null}

          {isAdmin ? (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdminRetry}
                disabled={retrying}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying...' : 'Retry provisioning'}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to={auditHref}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View audit log
                </Link>
              </Button>
            </div>
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
            <Button variant="outline" size="icon" onClick={handleCopy} className="h-8 w-8">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
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

        {isAdmin ? (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleAdminRetry} disabled={retrying}>
              <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Retrying...' : 'Re-run provisioning'}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to={auditHref}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View audit log
              </Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
