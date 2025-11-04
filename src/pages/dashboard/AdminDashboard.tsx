import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { RevenueChart } from '@/components/dashboard/charts/RevenueChart';
import { TransactionPieChart } from '@/components/dashboard/charts/TransactionPieChart';
import { TopStudentsChart } from '@/components/dashboard/charts/TopStudentsChart';
import { ProfileSection } from '@/components/dashboard/ProfileSection';
import { Users, Wallet, TrendingUp, DollarSign, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [studentsRes, walletsRes, transactionsRes] = await Promise.all([
        supabase.from('student_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('wallets').select('balance'),
        supabase.from('transactions').select('*').eq('status', 'completed'),
      ]);

      const totalBalance = walletsRes.data?.reduce((sum, w) => sum + Number(w.balance), 0) || 0;
      const todayTransactions = transactionsRes.data?.filter(t => {
        const today = new Date().toDateString();
        return new Date(t.created_at).toDateString() === today;
      }) || [];
      
      const todayCollection = todayTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        totalStudents: studentsRes.count || 0,
        totalBalance,
        todayCollection,
        totalTransactions: transactionsRes.data?.length || 0,
      };
    },
  });

  const { data: recentTransactions = [] } = useQuery({
    queryKey: ['admin-recent-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: topStudents = [] } = useQuery({
    queryKey: ['top-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance, user_id, profiles(first_name, last_name)')
        .order('balance', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data.map((w: any) => {
        const profile = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;
        return {
          name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown',
          balance: Number(w.balance)
        };
      });
    },
  });

  const { data: revenueData = [] } = useQuery({
    queryKey: ['revenue-trend'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('created_at, amount, type')
        .eq('status', 'completed')
        .eq('type', 'credit')
        .order('created_at', { ascending: true })
        .limit(30);
      
      if (error) throw error;
      
      // Group by date
      const grouped = data.reduce((acc: any, t) => {
        const date = new Date(t.created_at).toLocaleDateString();
        if (!acc[date]) acc[date] = 0;
        acc[date] += Number(t.amount);
        return acc;
      }, {});
      
      return Object.entries(grouped).map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: amount as number
      }));
    },
  });

  const creditAmount = recentTransactions
    .filter(t => t.type === 'credit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const debitAmount = recentTransactions
    .filter(t => t.type === 'debit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Complete overview and management portal</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Students"
          value={stats?.totalStudents || 0}
          icon={Users}
          description="Active accounts"
        />
        <StatCard
          title="Total Balance"
          value={`₦${(stats?.totalBalance || 0).toLocaleString('en-NG')}`}
          icon={Wallet}
          description="All wallets"
        />
        <StatCard
          title="Today's Collection"
          value={`₦${(stats?.todayCollection || 0).toLocaleString('en-NG')}`}
          icon={DollarSign}
          description="From all transactions"
        />
        <StatCard
          title="Total Transactions"
          value={stats?.totalTransactions || 0}
          icon={Activity}
          description="Completed"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <RevenueChart data={revenueData} />
            <TransactionPieChart creditAmount={creditAmount} debitAmount={debitAmount} />
          </div>
          <TopStudentsChart data={topStudents} />
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={recentTransactions.slice(0, 5)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={recentTransactions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <RevenueChart data={revenueData} />
            <TransactionPieChart creditAmount={creditAmount} debitAmount={debitAmount} />
          </div>
          <TopStudentsChart data={topStudents} />
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <ProfileSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
