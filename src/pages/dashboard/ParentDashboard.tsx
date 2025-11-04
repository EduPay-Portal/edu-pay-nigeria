import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { ProfileSection } from '@/components/dashboard/ProfileSection';
import { Users, Wallet, TrendingUp, Activity } from 'lucide-react';

export default function ParentDashboard() {
  const { user } = useAuth();

  const { data: children = [] } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          ),
          wallets:user_id (
            balance
          )
        `)
        .eq('parent_id', user?.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['parent-transactions', user?.id],
    queryFn: async () => {
      const childrenIds = children.map(c => c.user_id);
      if (childrenIds.length === 0) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .in('user_id', childrenIds)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: children.length > 0,
  });

  const totalBalance = children.reduce((sum, child) => {
    return sum + (child.wallets?.[0]?.balance || 0);
  }, 0);

  const totalSpent = transactions
    ?.filter(t => t.type === 'debit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const transactionCount = transactions?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Parent Dashboard</h1>
        <p className="text-muted-foreground">Monitor and manage your children's accounts</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Children"
          value={children.length}
          icon={Users}
          description="Active accounts"
        />
        <StatCard
          title="Combined Balance"
          value={`₦${totalBalance.toLocaleString('en-NG')}`}
          icon={Wallet}
          description="All children"
        />
        <StatCard
          title="Total Spent"
          value={`₦${totalSpent.toLocaleString('en-NG')}`}
          icon={TrendingUp}
          description="This month"
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
          <TabsTrigger value="children">Children</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {children.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">No children linked to your account yet.</p>
                </CardContent>
              </Card>
            ) : (
              children.map((child: any) => (
                <Card key={child.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">
                          {child.profiles?.first_name} {child.profiles?.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {child.class_level} {child.section && `- ${child.section}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Admission: {child.admission_number}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">Wallet Balance</p>
                      <p className="text-2xl font-bold text-primary">
                        ₦{(child.wallets?.[0]?.balance || 0).toLocaleString('en-NG')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={transactions.slice(0, 5)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="children" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Children Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {children.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No children linked to your account yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {children.map((child: any) => (
                    <Card key={child.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <h3 className="font-semibold">
                            {child.profiles?.first_name} {child.profiles?.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {child.class_level} {child.section && `- Section ${child.section}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Admission No: {child.admission_number}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Balance</p>
                          <p className="text-xl font-bold">
                            ₦{(child.wallets?.[0]?.balance || 0).toLocaleString('en-NG')}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
