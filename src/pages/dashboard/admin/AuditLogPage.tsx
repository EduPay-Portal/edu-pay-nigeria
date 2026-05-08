import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip: string | null;
  created_at: string;
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('id, actor_id, action, entity_type, entity_id, ip, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      setRows((data ?? []) as AuditRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Audit Log
        </h1>
        <p className="text-muted-foreground">Sensitive admin & payment actions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Most recent 200 events</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No audit events yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.created_at), 'PPpp')}</TableCell>
                      <TableCell className="font-mono text-sm">{r.action}</TableCell>
                      <TableCell className="text-xs">{r.entity_type}/{r.entity_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{r.actor_id?.slice(0, 8) ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.ip ?? '—'}</TableCell>
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
