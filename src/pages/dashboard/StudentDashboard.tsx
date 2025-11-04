import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { WalletCard } from '@/components/dashboard/WalletCard';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionPieChart } from '@/components/dashboard/charts/TransactionPieChart';
import { ProfileSection } from '@/components/dashboard/ProfileSection';
import { TrendingUp, CreditCard, History, Activity } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();

  const { data: wallet } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const totalSpent = transactions
    ?.filter(t => t.type === 'debit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const totalTopups = transactions
    ?.filter(t => t.type === 'credit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const transactionCount = transactions?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Manage your wallet and transactions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <WalletCard balance={wallet?.balance || 0} />
        <StatCard
          title="Total Spent"
          value={`₦${totalSpent.toLocaleString('en-NG')}`}
          icon={TrendingUp}
          description="This month"
        />
        <StatCard
          title="Total Top-ups"
          value={`₦${totalTopups.toLocaleString('en-NG')}`}
          icon={CreditCard}
          description="All time"
        />
        <StatCard
          title="Transactions"
          value={transactionCount}
          icon={Activity}
          description="Total count"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TransactionPieChart creditAmount={totalTopups} debitAmount={totalSpent} />
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Available Balance</span>
                  <span className="text-2xl font-bold text-primary">
                    ₦{(wallet?.balance || 0).toLocaleString('en-NG')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Transaction</span>
                  <span className="text-lg font-semibold">
                    ₦{transactionCount > 0 ? Math.round((totalSpent + totalTopups) / transactionCount).toLocaleString('en-NG') : 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={transactions.slice(0, 5)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={transactions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <ProfileSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
