import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Banknote, Info } from 'lucide-react';
import { format } from 'date-fns';

interface Settlement {
  id: string;
  provider: string;
  settlement_date: string;
  gross_amount: number;
  fees: number;
  net_amount: number;
  transaction_count: number;
  bank_reference: string | null;
  status: string;
}

interface Inflow {
  live_count: number;
  live_amount: number;
  today_count: number;
  today_amount: number;
  simulated_count: number;
  simulated_amount: number;
}

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

export default function SettlementsPage() {
  const settlementsQ = useQuery({
    queryKey: ['admin-settlements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .order('settlement_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Settlement[];
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const inflowQ = useQuery({
    queryKey: ['admin-live-inflow'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_live_inflow_summary');
      if (error) throw error;
      return ((data as Inflow[] | null)?.[0] ?? null);
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const rows = settlementsQ.data ?? [];
  const inflow = inflowQ.data;
  const totalNet = rows.reduce((sum, r) => sum + Number(r.net_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="h-6 w-6" /> Settlements
        </h1>
        <p className="text-muted-foreground">Live payments received and bank settlements into the school account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments received, awaiting bank settlement</CardTitle>
          <CardDescription>
            Real student payments recorded instantly. Simulator test payments are not counted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inflowQ.isLoading ? (
            <div className="grid gap-4 md:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : inflowQ.error ? (
            <p className="text-sm text-destructive">Could not load live payments: {(inflowQ.error as Error).message}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Today (Lagos time)</p>
                <p className="text-2xl font-bold text-primary">{naira(inflow?.today_amount ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{inflow?.today_count ?? 0} payment(s)</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total awaiting settlement</p>
                <p className="text-2xl font-bold">{naira(inflow?.live_amount ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{inflow?.live_count ?? 0} payment(s)</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Simulator (excluded)</p>
                <p className="text-2xl font-bold text-muted-foreground">{naira(inflow?.simulated_amount ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{inflow?.simulated_count ?? 0} test payment(s)</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Bank settlements</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Net settled</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-primary">{naira(totalNet)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pending settlements</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">
            {rows.filter(r => r.status === 'pending').length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank Settlement Records</CardTitle>
          <CardDescription className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            Added when Wema settles collected funds into the school collection account (end-of-day batches).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settlementsQ.isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No bank settlement records yet. Live payments above are already credited to student wallets.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Fees</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Txns</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.settlement_date), 'PPP')}</TableCell>
                      <TableCell><Badge>{r.provider}</Badge></TableCell>
                      <TableCell>{naira(r.gross_amount)}</TableCell>
                      <TableCell>{naira(r.fees)}</TableCell>
                      <TableCell className="font-semibold">{naira(r.net_amount)}</TableCell>
                      <TableCell>{r.transaction_count}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
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
