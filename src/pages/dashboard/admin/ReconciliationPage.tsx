import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, FileWarning } from 'lucide-react';
import { format } from 'date-fns';

interface UnmatchedWebhook {
  id: string;
  paystack_reference: string;
  event_type: string;
  payload: any;
  created_at: string;
}

interface DuplicateTransaction {
  paystack_reference: string;
  count: number;
  total_amount: number;
  transactions: any[];
}

interface TransactionWithoutWebhook {
  id: string;
  reference: string;
  paystack_reference: string;
  amount: number;
  status: string;
  created_at: string;
  user_id: string;
}

export default function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState('unmatched');

  // Fetch unmatched webhooks (webhooks without corresponding transactions)
  const { data: unmatchedWebhooks, isLoading: loadingUnmatched } = useQuery({
    queryKey: ['unmatched-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_unmatched_webhooks');
      if (error) throw error;
      return data as UnmatchedWebhook[];
    },
  });

  // Fetch duplicate transactions (same paystack reference)
  const { data: duplicateTransactions, isLoading: loadingDuplicates } = useQuery({
    queryKey: ['duplicate-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_duplicate_transactions');
      if (error) throw error;
      return data as DuplicateTransaction[];
    },
  });

  // Fetch transactions without webhooks
  const { data: orphanedTransactions, isLoading: loadingOrphaned } = useQuery({
    queryKey: ['orphaned-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_orphaned_transactions');
      if (error) throw error;
      return data as TransactionWithoutWebhook[];
    },
  });

  const stats = {
    unmatched: unmatchedWebhooks?.length || 0,
    duplicates: duplicateTransactions?.length || 0,
    orphaned: orphanedTransactions?.length || 0,
    total: (unmatchedWebhooks?.length || 0) + (duplicateTransactions?.length || 0) + (orphanedTransactions?.length || 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Payment Reconciliation</h1>
        <p className="text-muted-foreground">Identify and resolve payment discrepancies</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unmatched Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.unmatched}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duplicates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.duplicates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orphaned Txns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.orphaned}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Details</CardTitle>
          <CardDescription>Review and resolve payment mismatches</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="unmatched" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Unmatched ({stats.unmatched})
              </TabsTrigger>
              <TabsTrigger value="duplicates" className="gap-2">
                <XCircle className="h-4 w-4" />
                Duplicates ({stats.duplicates})
              </TabsTrigger>
              <TabsTrigger value="orphaned" className="gap-2">
                <FileWarning className="h-4 w-4" />
                Orphaned ({stats.orphaned})
              </TabsTrigger>
            </TabsList>

            {/* Unmatched Webhooks Tab */}
            <TabsContent value="unmatched" className="space-y-4">
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-yellow-900 dark:text-yellow-100">
                      Unmatched Webhooks
                    </div>
                    <div className="text-yellow-700 dark:text-yellow-300 mt-1">
                      These webhook events were received from Paystack but no corresponding transaction was created in the database.
                      This could indicate processing errors or delays.
                    </div>
                  </div>
                </div>
              </div>

              {loadingUnmatched ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : unmatchedWebhooks && unmatchedWebhooks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Received At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedWebhooks.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-mono text-sm">{webhook.paystack_reference}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{webhook.event_type}</Badge>
                        </TableCell>
                        <TableCell>
                          ₦{((webhook.payload?.data?.amount || 0) / 100).toLocaleString()}
                        </TableCell>
                        <TableCell>{format(new Date(webhook.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            Create Transaction
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <div>All webhooks have been matched successfully</div>
                </div>
              )}
            </TabsContent>

            {/* Duplicate Transactions Tab */}
            <TabsContent value="duplicates" className="space-y-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-red-900 dark:text-red-100">
                      Duplicate Transactions
                    </div>
                    <div className="text-red-700 dark:text-red-300 mt-1">
                      Multiple transactions found with the same Paystack reference. This indicates a potential double-processing issue.
                    </div>
                  </div>
                </div>
              </div>

              {loadingDuplicates ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : duplicateTransactions && duplicateTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicateTransactions.map((dup) => (
                      <TableRow key={dup.paystack_reference}>
                        <TableCell className="font-mono text-sm">{dup.paystack_reference}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{dup.count} duplicates</Badge>
                        </TableCell>
                        <TableCell>₦{dup.total_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            Resolve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <div>No duplicate transactions found</div>
                </div>
              )}
            </TabsContent>

            {/* Orphaned Transactions Tab */}
            <TabsContent value="orphaned" className="space-y-4">
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 p-4">
                <div className="flex items-start gap-3">
                  <FileWarning className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-purple-900 dark:text-purple-100">
                      Orphaned Transactions
                    </div>
                    <div className="text-purple-700 dark:text-purple-300 mt-1">
                      Transactions created without a corresponding webhook event. These may be manual entries or test transactions.
                    </div>
                  </div>
                </div>
              </div>

              {loadingOrphaned ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : orphanedTransactions && orphanedTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orphanedTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono text-sm">{txn.paystack_reference || txn.reference}</TableCell>
                        <TableCell>₦{txn.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={txn.status === 'completed' ? 'default' : 'secondary'}>
                            {txn.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(txn.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            Verify
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <div>All transactions are properly linked</div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
