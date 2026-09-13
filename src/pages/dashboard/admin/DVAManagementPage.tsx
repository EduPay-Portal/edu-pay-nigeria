import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Landmark, RefreshCw, AlertTriangle } from 'lucide-react';

const ACCOUNT_PREFIX = '711';

interface VA {
  id: string;
  student_id: string;
  provider: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  status: string;
  is_active: boolean;
  environment: string;
  created_at: string;
}

export default function DVAManagementPage() {
  const [accounts, setAccounts] = useState<VA[]>([]);
  const [loading, setLoading] = useState(true);
  const [reissuing, setReissuing] = useState(false);
  const [retiring, setRetiring] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('virtual_accounts')
      .select('id, student_id, provider, account_number, account_name, bank_name, status, is_active, environment, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    else setAccounts((data ?? []) as VA[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const legacyAccounts = accounts.filter(a => a.status === 'active' && !a.account_number.startsWith(ACCOUNT_PREFIX));

  const handleRetireLegacy = async () => {
    if (!window.confirm(
      `This will retire ${legacyAccounts.length} old account number(s) in this batch and issue new ${ACCOUNT_PREFIX}-prefixed ones. Payments to the old numbers will be rejected. Continue?`
    )) return;
    setRetiring(true);
    try {
      const { data, error } = await supabase.functions.invoke('dva-retire-legacy', { body: { limit: 50 } });
      if (error) throw error;
      const s = data?.summary;
      toast.success(`Reissued ${s?.reissued ?? 0}, skipped ${s?.skipped ?? 0}, errors ${s?.errors ?? 0}`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? 'Retire & reissue failed');
    } finally {
      setRetiring(false);
    }
  };

  const handleReissue = async () => {
    setReissuing(true);
    try {
      const { data, error } = await supabase.functions.invoke('dva-reissue', { body: { limit: 50 } });
      if (error) throw error;
      const summary = data?.summary;
      toast.success(`Re-issue done: ${summary?.total ?? 0} processed`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? 'Reissue failed');
    } finally {
      setReissuing(false);
    }
  };

  const wemaCount = accounts.filter(a => a.provider === 'wema' && a.status === 'active').length;
  const archivedCount = accounts.filter(a => a.status === 'archived' || a.status === 'retired').length;

  return (
    
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Landmark className="h-6 w-6" /> Virtual Account Management
            </h1>
            <p className="text-muted-foreground">Direct Wema Bank Virtual NUBANs</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleReissue} disabled={reissuing || retiring}>
              <RefreshCw className={`h-4 w-4 mr-2 ${reissuing ? 'animate-spin' : ''}`} />
              {reissuing ? 'Re-issuing…' : 'Re-issue Wema DVAs (batch of 50)'}
            </Button>
            <Button onClick={handleRetireLegacy} disabled={retiring || reissuing || legacyAccounts.length === 0}>
              <RefreshCw className={`h-4 w-4 mr-2 ${retiring ? 'animate-spin' : ''}`} />
              {retiring ? 'Reissuing…' : 'Retire & reissue legacy accounts'}
            </Button>
          </div>
        </div>

        {legacyAccounts.length > 0 && (
          <Card className="border-destructive/40">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">
                  {legacyAccounts.length} account{legacyAccounts.length === 1 ? '' : 's'} still use an old number
                </p>
                <p className="text-muted-foreground">
                  Only numbers starting with {ACCOUNT_PREFIX} are recognised by the bank. Retire and reissue them,
                  then send each student their new number.
                </p>
              </div>
            </CardContent>
          </Card>
        )}


        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Active Wema</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold text-primary">{wemaCount}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Archived</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold text-muted-foreground">{archivedCount}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{accounts.length}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Virtual Accounts</CardTitle>
            <CardDescription>Most recent 500</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No virtual accounts yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Env</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono">{a.account_number}</TableCell>
                        <TableCell>{a.account_name}</TableCell>
                        <TableCell>{a.bank_name}</TableCell>
                        <TableCell>
                          <Badge variant={a.provider === 'wema' ? 'default' : 'outline'}>
                            {a.provider}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{a.environment}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    
  );
}
