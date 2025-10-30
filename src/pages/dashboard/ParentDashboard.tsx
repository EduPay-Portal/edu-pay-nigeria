import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { Users, Wallet, TrendingUp } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Parent Dashboard</h1>
        <p className="text-muted-foreground">Manage your children's accounts and payments.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
        />
        <StatCard
          title="Total Spent"
          value={`₦${totalSpent.toLocaleString('en-NG')}`}
          icon={TrendingUp}
          description="This month"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            My Children
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

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionTable transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
