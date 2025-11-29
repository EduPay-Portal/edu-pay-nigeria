import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { RevenueChart } from '@/components/dashboard/charts/RevenueChart';
import { TransactionPieChart } from '@/components/dashboard/charts/TransactionPieChart';
import { TopStudentsChart } from '@/components/dashboard/charts/TopStudentsChart';
import { ProfileSection } from '@/components/dashboard/ProfileSection';
import { Users, Wallet, TrendingUp, DollarSign, Activity, Sparkles, Upload, PlayCircle, UserPlus, FileText, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const { data: stats, isLoading: statsLoading } = useQuery({
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

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
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
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {stats?.totalTransactions === 0 && (
            <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Getting Started
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Your dashboard is ready! Here's what to do next:
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button variant="outline" asChild>
                    <Link to="/dashboard/admin/students">
                      <Users className="mr-2 h-4 w-4" /> Manage Students
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/dashboard/admin/bulk-import">
                      <Upload className="mr-2 h-4 w-4" /> Import Students
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/dashboard/admin/payment-simulator">
                      <PlayCircle className="mr-2 h-4 w-4" /> Test Payment Flow
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/dashboard/admin/students')}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-950">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold">View All Students</p>
                  <p className="text-sm text-muted-foreground">Manage student accounts</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/dashboard/admin/parents')}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-950">
                  <UserPlus className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold">View All Parents</p>
                  <p className="text-sm text-muted-foreground">Manage parent profiles</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/dashboard/admin/transactions')}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-950">
                  <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-semibold">View Transactions</p>
                  <p className="text-sm text-muted-foreground">Payment history & logs</p>
                </div>
              </CardContent>
            </Card>
          </div>

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
