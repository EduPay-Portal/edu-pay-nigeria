import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Filter, ArrowUpRight, ArrowDownRight, Receipt, TrendingUp, TrendingDown, Clock, RefreshCw, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { format } from 'date-fns';
import { downloadReceipt } from '@/lib/receipt';
import { toast } from 'sonner';

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupInput, setLookupInput] = useState('');
  const [activeLookup, setActiveLookup] = useState<string | null>(null);
  const [livePolling, setLivePolling] = useState(true);

  // Single-record lookup with live polling while pending
  const lookupQuery = useQuery({
    queryKey: ['admin-tx-lookup', activeLookup],
    enabled: !!activeLookup,
    refetchInterval: (query) => {
      if (!livePolling) return false;
      const data = query.state.data as any;
      if (!data) return 3000;
      return data.status === 'pending' ? 3000 : false;
    },
    queryFn: async () => {
      const ref = activeLookup!.trim();
      // Try provider_reference first, then internal reference
      const { data: byProvider } = await supabase
        .from('transactions')
        .select('*, profiles:user_id(first_name, last_name, email)')
        .eq('provider_reference', ref)
        .maybeSingle();
      if (byProvider) return byProvider;
      const { data: byRef } = await supabase
        .from('transactions')
        .select('*, profiles:user_id(first_name, last_name, email)')
        .eq('reference', ref)
        .maybeSingle();
      return byRef;
    },
  });

  const handleLookup = () => {
    const v = lookupInput.trim();
    if (!v) {
      toast.error('Enter a reference to look up');
      return;
    }
    setLivePolling(true);
    setActiveLookup(v);
  };

  const lookupResult = lookupQuery.data as any;
  const lookupProfile = lookupResult
    ? Array.isArray(lookupResult.profiles)
      ? lookupResult.profiles[0]
      : lookupResult.profiles
    : null;

  // Fetch all transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          ),
          user_roles!inner (
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate statistics
  const totalTransactions = transactions?.length || 0;
  const completedTransactions = transactions?.filter(t => t.status === 'completed').length || 0;
  const pendingTransactions = transactions?.filter(t => t.status === 'pending').length || 0;

  const totalCredits = transactions
    ?.filter(t => t.type === 'credit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const totalDebits = transactions
    ?.filter(t => t.type === 'debit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Filter transactions based on search
  const filteredTransactions = transactions?.filter(transaction => {
    const profile = Array.isArray(transaction.profiles) ? transaction.profiles[0] : transaction.profiles;
    const searchLower = searchQuery.toLowerCase();
    return (
      transaction.reference?.toLowerCase().includes(searchLower) ||
      profile?.first_name?.toLowerCase().includes(searchLower) ||
      profile?.last_name?.toLowerCase().includes(searchLower) ||
      transaction.category?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'reversed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'fee_payment': return 'bg-blue-500/10 text-blue-500';
      case 'wallet_topup': return 'bg-green-500/10 text-green-500';
      case 'canteen': return 'bg-orange-500/10 text-orange-500';
      case 'books': return 'bg-purple-500/10 text-purple-500';
      case 'transport': return 'bg-cyan-500/10 text-cyan-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Transactions Management</h1>
        <p className="text-muted-foreground">Monitor and manage all financial transactions</p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Transactions"
          value={totalTransactions.toString()}
          icon={Receipt}
        />
        <StatCard
          title="Total Credits"
          value={`₦${totalCredits.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Debits"
          value={`₦${totalDebits.toLocaleString()}`}
          icon={TrendingDown}
        />
        <StatCard
          title="Pending"
          value={pendingTransactions.toString()}
          icon={Clock}
        />
      </div>

      {/* Reference Lookup */}
      <Card>
        <CardHeader>
          <CardTitle>Reference Lookup</CardTitle>
          <CardDescription>
            Search by provider reference or internal reference. Status updates live every 3s while pending.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="e.g. TEST_abc123 or TXN-20260503-000123"
                className="pl-10 font-mono"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              />
            </div>
            <Button onClick={handleLookup} disabled={lookupQuery.isFetching}>
              {lookupQuery.isFetching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Look up
            </Button>
            {activeLookup && (
              <Button
                variant="outline"
                onClick={() => {
                  setActiveLookup(null);
                  setLookupInput('');
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {activeLookup && lookupQuery.isLoading && (
            <div className="text-sm text-muted-foreground">Searching…</div>
          )}

          {activeLookup && !lookupQuery.isLoading && !lookupResult && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No transaction found for <span className="font-mono">{activeLookup}</span>.
            </div>
          )}

          {lookupResult && (
            <div className="rounded-md border p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    {lookupResult.type === 'credit' ? '+' : '-'}₦
                    {Number(lookupResult.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {lookupResult.type} • {String(lookupResult.category).replace('_', ' ')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(lookupResult.status)}>{lookupResult.status}</Badge>
                  {lookupResult.status === 'pending' && livePolling && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3 animate-spin" /> live
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Internal reference</div>
                  <div className="font-mono break-all">{lookupResult.reference}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Provider reference</div>
                  <div className="font-mono break-all">{lookupResult.provider_reference || lookupResult.paystack_reference || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Payer</div>
                  <div className="font-medium">
                    {lookupProfile?.first_name} {lookupProfile?.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">{lookupProfile?.email}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Channel</div>
                  <div className="capitalize">
                    {(lookupResult.payment_channel || lookupResult.payment_method || lookupResult.provider || '—').replace('_', ' ')}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground">Created</div>
                  <div>{format(new Date(lookupResult.created_at), 'MMM dd, yyyy HH:mm:ss')}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lookupQuery.refetch()}
                  disabled={lookupQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${lookupQuery.isFetching ? 'animate-spin' : ''}`} />
                  Refresh now
                </Button>
                {lookupResult.status === 'pending' && (
                  <Button variant="outline" size="sm" onClick={() => setLivePolling((v) => !v)}>
                    {livePolling ? 'Pause live updates' : 'Resume live updates'}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    downloadReceipt({
                      reference: lookupResult.reference,
                      providerReference: lookupResult.provider_reference ?? lookupResult.paystack_reference,
                      amount: Number(lookupResult.amount),
                      status: lookupResult.status,
                      type: lookupResult.type,
                      category: lookupResult.category,
                      paymentMethod: lookupResult.payment_method,
                      paymentChannel: lookupResult.payment_channel,
                      provider: lookupResult.provider,
                      description: lookupResult.description,
                      createdAt: lookupResult.created_at,
                      payerName:
                        [lookupProfile?.first_name, lookupProfile?.last_name]
                          .filter(Boolean)
                          .join(' ') || null,
                      payerEmail: lookupProfile?.email ?? null,
                    })
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download receipt
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Complete transaction history</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference, user, or category..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
          ) : filteredTransactions && filteredTransactions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => {
                    const profile = Array.isArray(transaction.profiles) ? transaction.profiles[0] : transaction.profiles;
                    const userRole = Array.isArray(transaction.user_roles) ? transaction.user_roles[0] : transaction.user_roles;

                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-sm">{transaction.reference}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {profile?.first_name} {profile?.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground capitalize">{userRole?.role}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {transaction.type === 'credit' ? (
                              <ArrowUpRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-500" />
                            )}
                            <span className="capitalize">{transaction.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`font-semibold ${transaction.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                          {transaction.type === 'credit' ? '+' : '-'}₦{Number(transaction.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={getCategoryColor(transaction.category)}>
                            {transaction.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(transaction.status)}>
                            {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No transactions found matching your search.' : 'No transactions found.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
