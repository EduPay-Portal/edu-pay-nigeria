import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertTriangle, Download } from 'lucide-react';
import { downloadReceipt } from '@/lib/receipt';

type PollState = 'polling' | 'success' | 'timeout';

interface ResolvedTx {
  id: string;
  amount: number;
  reference: string;
  paystack_reference: string | null;
  status: string;
  type: string;
  category: string;
  payment_method: string | null;
  payment_channel: string | null;
  provider: string | null;
  description: string | null;
  created_at: string;
}

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 10;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const reference = params.get('reference') ?? '';

  const [state, setState] = useState<PollState>('polling');
  const [tx, setTx] = useState<ResolvedTx | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!reference) {
      setState('timeout');
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      setAttempt(attempts);

      const { data } = await supabase
        .from('transactions')
        .select('id, amount, reference, paystack_reference, status')
        .eq('paystack_reference', reference)
        .maybeSingle();

      if (cancelled) return;

      if (data && data.status === 'completed') {
        setTx(data as ResolvedTx);
        setState('success');

        if (user?.id) {
          const { data: wallet } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!cancelled && wallet) setWalletBalance(Number(wallet.balance));
        }

        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['student-details'] });
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        setState('timeout');
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [reference, queryClient, user?.id]);

  const goToDashboard = () => {
    // Best-effort role-aware redirect; ProtectedRoute will route correctly anyway
    navigate('/dashboard/student');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        {state === 'polling' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <CardTitle>Confirming your payment…</CardTitle>
              <CardDescription>
                Reference: <span className="font-mono text-xs">{reference || '—'}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Attempt {attempt} of {MAX_ATTEMPTS}. This usually takes a few seconds.
              </p>
            </CardContent>
          </>
        )}

        {state === 'success' && tx && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>
              <CardTitle>Payment successful</CardTitle>
              <CardDescription>Your wallet has been credited.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">
                    ₦{Number(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {walletBalance !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New balance</span>
                    <span className="font-semibold text-primary">
                      ₦{walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono">{tx.reference}</span>
                </div>
              </div>
              <Button className="w-full" onClick={goToDashboard}>
                Back to dashboard
              </Button>
            </CardContent>
          </>
        )}

        {state === 'timeout' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
                <AlertTriangle className="h-8 w-8 text-warning" />
              </div>
              <CardTitle>Still processing</CardTitle>
              <CardDescription>
                Your payment was received but hasn't reflected yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Your wallet will update shortly. You can refresh, or check the Transactions page in a few moments.
              </p>
              {reference && (
                <p className="text-xs text-center font-mono text-muted-foreground">
                  {reference}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
                <Button className="w-full" onClick={goToDashboard}>
                  Dashboard
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
