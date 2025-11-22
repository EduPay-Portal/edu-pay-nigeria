import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Building2, AlertCircle } from 'lucide-react';
import { usePaystackPayment } from '@/hooks/usePaystackPayment';
import { useAuth } from '@/contexts/AuthContext';
import { VirtualAccountCard } from '@/components/dashboard/VirtualAccountCard';
import { toast } from 'sonner';

interface TopUpWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId?: string;
  studentName?: string;
}

export function TopUpWalletDialog({ open, onOpenChange, studentId, studentName }: TopUpWalletDialogProps) {
  const { user } = useAuth();
  const { initiatePayment, isProcessing } = usePaystackPayment();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer'>('card');

  const handlePayment = () => {
    const amountValue = parseFloat(amount);

    if (isNaN(amountValue) || amountValue < 100) {
      toast.error('Please enter a valid amount (minimum ₦100)');
      return;
    }

    if (amountValue > 500000) {
      toast.error('Maximum amount is ₦500,000 per transaction');
      return;
    }

    if (paymentMethod === 'card') {
      initiatePayment({
        email: user?.email || '',
        amount: amountValue,
        onSuccess: (reference) => {
          toast.success('Payment successful! Your wallet will be updated shortly.');
          onOpenChange(false);
          setAmount('');
        },
        onClose: () => {
          toast.info('Payment cancelled');
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Top Up Wallet</DialogTitle>
          <DialogDescription>
            {studentName ? `Add funds to ${studentName}'s wallet` : 'Add funds to your wallet'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (NGN)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={100}
              max={500000}
            />
            <p className="text-xs text-muted-foreground">Minimum: ₦100 | Maximum: ₦500,000</p>
          </div>

          <div className="space-y-3">
            <Label>Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'card' | 'transfer')}>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-4 w-4" />
                  <span>Debit/Credit Card</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="transfer" id="transfer" />
                <Label htmlFor="transfer" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Building2 className="h-4 w-4" />
                  <span>Bank Transfer (to Virtual Account)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {paymentMethod === 'transfer' && (
            <div className="pt-2">
              <VirtualAccountCard studentId={studentId} showCreateButton={false} />
              <div className="mt-3 bg-warning/10 border border-warning/20 rounded-md p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning-foreground">
                    Transfer the amount above to your virtual account. Your wallet will be credited within 5-30 minutes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'card' && (
            <Button 
              onClick={handlePayment} 
              disabled={isProcessing || !amount}
              className="w-full"
            >
              {isProcessing ? 'Processing...' : 'Pay Now'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
