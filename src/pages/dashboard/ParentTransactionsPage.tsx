import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionTable } from '@/components/dashboard/TransactionTable';

export default function ParentTransactionsPage() {
  const { user } = useAuth();

  const { data: children = [] } = useQuery({
    queryKey: ['parent-children-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select('user_id')
        .eq('parent_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const childrenIds = children.map((c: any) => c.user_id);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['parent-transactions-all', user?.id, childrenIds.join(',')],
    queryFn: async () => {
      if (childrenIds.length === 0) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .in('user_id', childrenIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: childrenIds.length > 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">All transactions across your children's accounts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
          ) : (
            <TransactionTable transactions={transactions} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
