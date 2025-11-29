import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FlaskConical, Wallet, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { PaymentFlowVisualizer, type FlowStep } from '@/components/admin/PaymentFlowVisualizer';
import { formatDistanceToNow } from 'date-fns';

export default function PaymentSimulatorPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([
    { step: 1, name: 'Webhook Received', status: 'pending' },
    { step: 2, name: 'Virtual Account', status: 'pending' },
    { step: 3, name: 'Wallet Located', status: 'pending' },
    { step: 4, name: 'Transaction Created', status: 'pending' },
    { step: 5, name: 'Balance Updated', status: 'pending' },
  ]);

  const queryClient = useQueryClient();

  // Fetch students with virtual accounts
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-with-va'],
    queryFn: async () => {
      // First, get all active virtual accounts
      const { data: virtualAccounts, error: vaError } = await supabase
        .from('virtual_accounts')
        .select('student_id, account_number, bank_name, is_active')
        .eq('is_active', true);

      if (vaError) throw vaError;
      if (!virtualAccounts || virtualAccounts.length === 0) return [];

      // Get the student IDs that have virtual accounts
      const studentIds = virtualAccounts.map(va => va.student_id);

      // Fetch student profiles with names for those students
      const { data: studentProfiles, error: spError } = await supabase
        .from('student_profiles')
        .select(`
          user_id,
          profiles!inner(first_name, last_name)
        `)
        .in('user_id', studentIds);

      if (spError) throw spError;
      if (!studentProfiles) return [];

      // Merge the data client-side
      return studentProfiles.map(sp => {
        const va = virtualAccounts.find(v => v.student_id === sp.user_id);
        return {
          user_id: sp.user_id,
          profiles: sp.profiles,
          virtual_accounts: va,
        };
      }).filter(s => s.virtual_accounts); // Only return students with VA
    },
  });

  // Get selected student's virtual account details
  const { data: selectedStudent } = useQuery({
    queryKey: ['student-details', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;

      const [profileResult, walletResult, vaResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', selectedStudentId)
          .single(),
        supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', selectedStudentId)
          .single(),
        supabase
          .from('virtual_accounts')
          .select('account_number, account_name, bank_name, last_payment_at')
          .eq('student_id', selectedStudentId)
          .eq('is_active', true)
          .single(),
      ]);

      if (profileResult.error || walletResult.error || vaResult.error) {
        throw new Error('Failed to fetch student details');
      }

      return {
        profile: profileResult.data,
        wallet: walletResult.data,
        virtualAccount: vaResult.data,
      };
    },
    enabled: !!selectedStudentId,
  });

  // Fetch recent simulations
  const { data: recentSimulations } = useQuery({
    queryKey: ['recent-simulations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          amount,
          paystack_reference,
          created_at,
          profiles!inner(first_name, last_name)
        `)
        .eq('payment_channel', 'simulation')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Simulate payment mutation
  const simulatePaymentMutation = useMutation({
    mutationFn: async ({ studentId, amount }: { studentId: string; amount: number }) => {
      // Reset flow steps
      setFlowSteps([
        { step: 1, name: 'Webhook Received', status: 'processing' },
        { step: 2, name: 'Virtual Account', status: 'pending' },
        { step: 3, name: 'Wallet Located', status: 'pending' },
        { step: 4, name: 'Transaction Created', status: 'pending' },
        { step: 5, name: 'Balance Updated', status: 'pending' },
      ]);

      // Simulate step-by-step progression
      await new Promise((resolve) => setTimeout(resolve, 500));
      setFlowSteps((prev) => prev.map((step) =>
        step.step === 1 ? { ...step, status: 'completed' } :
        step.step === 2 ? { ...step, status: 'processing' } : step
      ));

      await new Promise((resolve) => setTimeout(resolve, 500));
      setFlowSteps((prev) => prev.map((step) =>
        step.step === 2 ? { ...step, status: 'completed' } :
        step.step === 3 ? { ...step, status: 'processing' } : step
      ));

      await new Promise((resolve) => setTimeout(resolve, 500));
      setFlowSteps((prev) => prev.map((step) =>
        step.step === 3 ? { ...step, status: 'completed' } :
        step.step === 4 ? { ...step, status: 'processing' } : step
      ));

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('simulate-payment', {
        body: { student_id: studentId, amount },
      });

      if (error) throw error;

      await new Promise((resolve) => setTimeout(resolve, 500));
      setFlowSteps((prev) => prev.map((step) =>
        step.step === 4 ? { ...step, status: 'completed' } :
        step.step === 5 ? { ...step, status: 'processing' } : step
      ));

      await new Promise((resolve) => setTimeout(resolve, 500));
      setFlowSteps((prev) => prev.map((step) =>
        step.step === 5 ? { ...step, status: 'completed' } : step
      ));

      return data;
    },
    onSuccess: (data) => {
      toast.success('Payment simulated successfully!', {
        description: `Transaction ID: ${data.transaction_id}`,
      });
      queryClient.invalidateQueries({ queryKey: ['student-details', selectedStudentId] });
      queryClient.invalidateQueries({ queryKey: ['recent-simulations'] });
      setAmount('');
    },
    onError: (error: any) => {
      toast.error('Simulation failed', {
        description: error.message || 'An error occurred',
      });
      setFlowSteps((prev) => prev.map((step) =>
        step.status === 'processing' ? { ...step, status: 'error' } : step
      ));
    },
  });

  const handleSimulate = () => {
    if (!selectedStudentId || !amount) {
      toast.error('Please select a student and enter an amount');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    simulatePaymentMutation.mutate({ studentId: selectedStudentId, amount: amountNum });
  };

  const quickAmounts = [1000, 5000, 10000, 50000];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-primary" />
            Payment Simulator
          </h1>
          <p className="text-muted-foreground mt-1">
            Test the payment flow without real money
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          Test Mode
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Simulator Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Simulate Payment</CardTitle>
            <CardDescription>
              Select a student and amount to test the payment flow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student">Select Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger id="student">
                  <SelectValue placeholder="Choose a student..." />
                </SelectTrigger>
                <SelectContent>
                  {students?.map((student: any) => (
                    <SelectItem key={student.user_id} value={student.user_id}>
                      {student.profiles.first_name} {student.profiles.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label>Quick Amounts</Label>
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(quickAmount.toString())}
                  >
                    ₦{quickAmount.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSimulate}
              disabled={!selectedStudentId || !amount || simulatePaymentMutation.isPending}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              {simulatePaymentMutation.isPending ? 'Simulating...' : 'Simulate Payment'}
            </Button>
          </CardContent>
        </Card>

        {/* Student Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Student Preview</CardTitle>
            <CardDescription>Current wallet and virtual account details</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedStudent ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="text-lg font-semibold">
                    {selectedStudent.profile.first_name} {selectedStudent.profile.last_name}
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-muted-foreground">Current Balance</Label>
                    <p className="text-2xl font-bold text-primary">
                      ₦{selectedStudent.wallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                </div>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Virtual Account</Label>
                  <p className="font-mono text-lg font-semibold">
                    {selectedStudent.virtualAccount.account_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent.virtualAccount.bank_name}
                  </p>
                </div>
                {selectedStudent.virtualAccount.last_payment_at && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        Last payment: {formatDistanceToNow(new Date(selectedStudent.virtualAccount.last_payment_at), { addSuffix: true })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <p>Select a student to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Flow Visualization</CardTitle>
          <CardDescription>
            Watch each step of the payment processing in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentFlowVisualizer steps={flowSteps} />
        </CardContent>
      </Card>

      {/* Recent Simulations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Test Payments</CardTitle>
          <CardDescription>History of simulated transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSimulations && recentSimulations.length > 0 ? (
            <div className="space-y-3">
              {recentSimulations.map((sim: any) => (
                <div
                  key={sim.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {sim.profiles.first_name} {sim.profiles.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {sim.paystack_reference}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      ₦{sim.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(sim.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>No simulations yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
