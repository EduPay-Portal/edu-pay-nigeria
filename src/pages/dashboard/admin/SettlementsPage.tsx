import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Banknote } from 'lucide-react';
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

export default function SettlementsPage() {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('settlements')
        .select('*')
        .order('settlement_date', { ascending: false })
        .limit(200);
      setRows((data ?? []) as Settlement[]);
      setLoading(false);
    })();
  }, []);

  const totalNet = rows.reduce((sum, r) => sum + Number(r.net_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="h-6 w-6" /> Settlements
        </h1>
        <p className="text-muted-foreground">Daily settlement tracking by provider</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Settlements</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Net (Total)</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-primary">
            ₦{totalNet.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pending</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">
            {rows.filter(r => r.status === 'pending').length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Settlements</CardTitle>
          <CardDescription>Awaiting Wema settlement file ingestion</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No settlement records yet. They will appear automatically once Wema settlement
              files are ingested.
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
                      <TableCell>₦{Number(r.gross_amount).toLocaleString()}</TableCell>
                      <TableCell>₦{Number(r.fees).toLocaleString()}</TableCell>
                      <TableCell className="font-semibold">₦{Number(r.net_amount).toLocaleString()}</TableCell>
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
