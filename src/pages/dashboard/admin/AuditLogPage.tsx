import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { ShieldCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip: string | null;
  request_id: string | null;
  metadata: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const CATEGORY_FILTERS: Record<string, string[]> = {
  all: [],
  user_creation: ['user.create'],
  bulk_import: ['bulk_create_students', 'bulk_create_virtual_accounts'],
  virtual_account: ['virtual_account.', 'dva.'],
  reconciliation: ['reconciliation.'],
  payment: ['payment.'],
};

function categoryLabel(action: string): { label: string; tone: string } {
  if (action.startsWith('user.create')) return { label: 'User Created', tone: 'bg-blue-100 text-blue-800' };
  if (action.startsWith('bulk_create_students')) return { label: 'Bulk Students', tone: 'bg-purple-100 text-purple-800' };
  if (action.startsWith('bulk_create_virtual_accounts')) return { label: 'Bulk VAs', tone: 'bg-purple-100 text-purple-800' };
  if (action.startsWith('virtual_account.') || action.startsWith('dva.')) return { label: 'Virtual Account', tone: 'bg-emerald-100 text-emerald-800' };
  if (action.startsWith('reconciliation.')) return { label: 'Reconciliation', tone: 'bg-amber-100 text-amber-800' };
  if (action.startsWith('payment.')) return { label: 'Payment', tone: 'bg-cyan-100 text-cyan-800' };
  return { label: 'Other', tone: 'bg-slate-100 text-slate-800' };
}

export default function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRequestId = searchParams.get('request_id') ?? '';
  const initialStudentId = searchParams.get('student_id') ?? '';

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actorMap, setActorMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [requestIdFilter, setRequestIdFilter] = useState(initialRequestId);
  const [studentIdFilter, setStudentIdFilter] = useState(initialStudentId);
  const [reconciling, setReconciling] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, ip, request_id, metadata, before, after, created_at')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    if (requestIdFilter.trim()) query = query.eq('request_id', requestIdFilter.trim());
    if (studentIdFilter.trim()) query = query.or(`entity_id.eq.${studentIdFilter.trim()},metadata->>student_id.eq.${studentIdFilter.trim()}`);

    const prefixes = CATEGORY_FILTERS[category];
    if (prefixes.length === 1) query = query.like('action', `${prefixes[0]}%`);
    else if (prefixes.length > 1) {
      query = query.or(prefixes.map((p) => `action.like.${p}%`).join(','));
    }
    if (search.trim()) query = query.ilike('action', `%${search.trim()}%`);

    const { data } = await query;
    const list = (data ?? []) as AuditRow[];
    setHasMore(list.length > PAGE_SIZE);
    const trimmed = list.slice(0, PAGE_SIZE);
    setRows(trimmed);

    const actorIds = Array.from(new Set(trimmed.map((r) => r.actor_id).filter(Boolean) as string[]));
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', actorIds);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => {
        m[p.id] = p.email ?? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.id.slice(0, 8));
      });
      setActorMap(m);
    } else setActorMap({});
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, category, requestIdFilter, studentIdFilter]);

  const filtered = useMemo(() => rows, [rows]);

  const runReconciliation = async () => {
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-missing-virtual-accounts', { body: {} });
      if (error) throw error;
      toast.success('Reconciliation complete', {
        description: `Scanned ${data?.scanned ?? 0}, enqueued ${data?.enqueued ?? 0}, skipped ${data?.skipped ?? 0}.`,
      });
      load();
    } catch (e) {
      toast.error('Reconciliation failed', { description: e instanceof Error ? e.message : 'Try again.' });
    } finally {
      setReconciling(false);
    }
  };

  const clearFilters = () => {
    setRequestIdFilter('');
    setStudentIdFilter('');
    setSearchParams({});
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Audit Log
          </h1>
          <p className="text-muted-foreground">Sensitive admin & payment actions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runReconciliation} disabled={reconciling}>
            <RefreshCw className={`h-4 w-4 mr-2 ${reconciling ? 'animate-spin' : ''}`} />
            {reconciling ? 'Reconciling…' : 'Run VA reconciliation'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setPage(0); load(); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {(requestIdFilter || studentIdFilter) && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-muted-foreground">Active filters:</span>
          {requestIdFilter && <Badge variant="secondary" className="font-mono">request_id: {requestIdFilter.slice(0, 12)}…</Badge>}
          {studentIdFilter && <Badge variant="secondary" className="font-mono">student_id: {studentIdFilter.slice(0, 12)}…</Badge>}
          <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Filter by category or action keyword</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(0); }}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="user_creation">User Creation</SelectItem>
                <SelectItem value="bulk_import">Bulk Import</SelectItem>
                <SelectItem value="virtual_account">Virtual Account</SelectItem>
                <SelectItem value="reconciliation">Reconciliation</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(0); load(); } }}
              className="max-w-xs"
            />
            <Button variant="secondary" size="sm" onClick={() => { setPage(0); load(); }}>Search</Button>
          </div>

          {loading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No audit events match these filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Request ID</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const cat = categoryLabel(r.action);
                      return (
                        <TableRow
                          key={r.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setSelected(r)}
                        >
                          <TableCell className="whitespace-nowrap">{format(new Date(r.created_at), 'PP p')}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cat.tone}>{cat.label}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.action}</TableCell>
                          <TableCell className="text-xs">
                            {r.actor_id ? (actorMap[r.actor_id] ?? r.actor_id.slice(0, 8)) : '— system'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.entity_type ? `${r.entity_type}/${(r.entity_id ?? '').slice(0, 8)}` : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.request_id?.slice(0, 8) ?? '—'}</TableCell>
                          <TableCell className="text-xs">{r.ip ?? '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">Page {page + 1} · {filtered.length} rows</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-sm">{selected.action}</SheetTitle>
                <SheetDescription>{format(new Date(selected.created_at), 'PPpp')}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Actor</p>
                  <p>{selected.actor_id ? (actorMap[selected.actor_id] ?? selected.actor_id) : 'system / service-role'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Request ID</p>
                    <p className="font-mono break-all">{selected.request_id ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">IP</p>
                    <p className="font-mono">{selected.ip ?? '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Entity</p>
                  <p className="font-mono text-xs">{selected.entity_type ?? '—'} / {selected.entity_id ?? '—'}</p>
                </div>
                {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Metadata</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{JSON.stringify(selected.metadata, null, 2)}</pre>
                  </div>
                )}
                {selected.before && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Before</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{JSON.stringify(selected.before, null, 2)}</pre>
                  </div>
                )}
                {selected.after && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">After</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{JSON.stringify(selected.after, null, 2)}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
