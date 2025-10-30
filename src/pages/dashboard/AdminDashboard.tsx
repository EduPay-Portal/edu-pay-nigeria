import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { Users, Wallet, TrendingUp, DollarSign } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of school payments and transactions.</p>
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
          icon={TrendingUp}
          description="Completed"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionTable transactions={recentTransactions} />
        </CardContent>
      </Card>
    </div>
  );
}
