import { VirtualAccountCard } from '@/components/dashboard/VirtualAccountCard';
import { PaymentInstructions } from '@/components/dashboard/PaymentInstructions';
import { WalletCard } from '@/components/dashboard/WalletCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function StudentWalletPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Wallet</h1>
        <p className="text-muted-foreground">Fund your wallet by transferring to your virtual account.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <WalletCard balance={wallet?.balance || 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <VirtualAccountCard />
        <PaymentInstructions />
      </div>
    </div>
  );
}