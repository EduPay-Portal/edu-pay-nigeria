import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VirtualAccountCard } from '@/components/dashboard/VirtualAccountCard';
import { Users } from 'lucide-react';

export default function ParentChildrenPage() {
  const { user } = useAuth();

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select(`
          *,
          profiles:user_id ( first_name, last_name, email ),
          wallets:user_id ( balance )
        `)
        .eq('parent_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Children</h1>
        <p className="text-muted-foreground">View your children's accounts and virtual account details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Children
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : children.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No children linked to your account yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {children.map((child: any) => (
                <Card key={child.id}>
                  <CardContent className="p-6 space-y-4">
                    <div>
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

                    <VirtualAccountCard studentId={child.user_id} showCreateButton={false} />

                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">Wallet Balance</p>
                      <p className="text-2xl font-bold text-primary">
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
    </div>
  );
}
