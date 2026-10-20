import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

interface Row {
  user_id: string;
  name: string;
  admission_number: string;
  class_level: string;
  reason: string;
}

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export function StudentsWithoutVA({ canManage, prefix }: { canManage: boolean; prefix: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['students-without-va'],
    queryFn: async (): Promise<{ rows: Row[]; withVA: number }> => {
      const [{ data: students, error }, { data: vas }] = await Promise.all([
        supabase.from('student_profiles').select('user_id, admission_number, class_level').limit(5000),
        supabase.from('virtual_accounts').select('student_id, account_number, status').eq('status', 'active').limit(5000),
      ]);
      if (error) throw error;
      const has = new Set((vas ?? []).map(v => v.student_id));
      const missing = (students ?? []).filter(s => !has.has(s.user_id));
      const ids = missing.map(m => m.user_id);
      const profiles: Record<string, { first_name: string | null; last_name: string | null }> = {};
      const jobs: Record<string, { status: string; last_error: string | null }> = {};
      for (const c of chunk(ids, 100)) {
        const [{ data: p }, { data: j }] = await Promise.all([
          supabase.from('profiles').select('id, first_name, last_name').in('id', c),
          supabase.from('virtual_account_provisioning_jobs').select('student_id, status, last_error').in('student_id', c),
        ]);
        (p ?? []).forEach(x => { profiles[x.id] = x; });
        (j ?? []).forEach(x => { jobs[x.student_id] = x; });
      }
      const rows = missing.map(m => {
        const p = profiles[m.user_id];
        const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ');
        const job = jobs[m.user_id];
        const reason = !name ? 'Missing name'
          : job?.status === 'failed' ? `Failed: ${job.last_error ?? 'unknown error'}`
          : job?.status === 'pending' || job?.status === 'processing' ? 'Pending'
          : 'Not yet issued';
        return { user_id: m.user_id, name: name || '—', admission_number: m.admission_number, class_level: m.class_level, reason };
      });
      return { rows, withVA: (students?.length ?? 0) - rows.length };
    },
    refetchOnWindowFocus: true,
  });

  const issue = async (studentIds: string[]) => {
    setBusy(studentIds.length === 1 ? studentIds[0] : 'all');
    let ok = 0, fail = 0;
    for (const id of studentIds.slice(0, 50)) {
      const { data, error } = await supabase.functions.invoke('provision-student-virtual-account', {
        body: { student_id: id },
      });
      if (error || data?.error) fail++; else ok++;
    }
    setBusy(null);
    toast[fail ? 'warning' : 'success'](`Issued ${ok}, failed ${fail}`);
    qc.invalidateQueries({ queryKey: ['students-without-va'] });
    qc.invalidateQueries({ queryKey: ['virtual-accounts-admin'] });
  };

  const rows = q.data?.rows ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Students without a virtual account</CardTitle>
          <CardDescription>
            With account: {q.data?.withVA ?? '…'} · Without: {rows.length}
          </CardDescription>
        </div>
        {canManage && rows.length > 0 && (
          <Button onClick={() => issue(rows.filter(r => r.name !== '—').map(r => r.user_id))} disabled={!!busy}>
            <UserPlus className="h-4 w-4 mr-2" />
            {busy === 'all' ? 'Issuing…' : `Issue for all (batch of 50)`}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : q.error ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">Every student has an active virtual account.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission #</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.user_id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="font-mono">{r.admission_number}</TableCell>
                    <TableCell>{r.class_level}</TableCell>
                    <TableCell><Badge variant="outline">{r.reason}</Badge></TableCell>
                    {canManage && (
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={!!busy || r.name === '—'} onClick={() => issue([r.user_id])}>
                          {busy === r.user_id ? 'Issuing…' : 'Issue VA'}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
