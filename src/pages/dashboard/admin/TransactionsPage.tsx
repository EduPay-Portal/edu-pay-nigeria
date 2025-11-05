import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Filter, ArrowUpRight, ArrowDownRight, Receipt, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { format } from 'date-fns';

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('');

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
