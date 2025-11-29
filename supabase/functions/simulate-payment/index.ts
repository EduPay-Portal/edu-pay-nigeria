import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimulatePaymentRequest {
  student_id: string;
  amount: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verify authentication (admin only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: SimulatePaymentRequest = await req.json();
    const { student_id, amount } = body;

    if (!student_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid student_id or amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Simulating payment for student ${student_id}, amount: ₦${amount}`);

    // Step 1: Find student's virtual account
    const { data: virtualAccount, error: accountError } = await supabase
      .from('virtual_accounts')
      .select('id, student_id, account_number, account_name, bank_name')
      .eq('student_id', student_id)
      .eq('is_active', true)
      .single();

    if (accountError || !virtualAccount) {
      console.error('Virtual account not found:', accountError);
      return new Response(
        JSON.stringify({ 
          error: 'Virtual account not found for this student',
          step: 'virtual_account_lookup',
          details: accountError?.message
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Step 1: Virtual account found - ${virtualAccount.account_number}`);

    // Step 2: Find student's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', student_id)
      .single();

    if (walletError || !wallet) {
      console.error('Wallet not found:', walletError);
      return new Response(
        JSON.stringify({ 
          error: 'Wallet not found for this student',
          step: 'wallet_lookup',
          details: walletError?.message
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Step 2: Wallet found - ${wallet.id}`);

    // Generate test reference
    const testReference = `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Step 3: Check for duplicates (shouldn't happen with test refs but good practice)
    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('paystack_reference', testReference)
      .single();

    if (existingTransaction) {
      console.log('Duplicate test reference (extremely rare)');
      return new Response(
        JSON.stringify({ error: 'Duplicate reference generated, please retry' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Step 3: No duplicate found - ${testReference}`);

    // Step 4: Create webhook event log (for audit trail)
    const webhookPayload = {
      event: 'charge.success',
      data: {
        reference: testReference,
        amount: amount * 100, // Store in kobo like Paystack
        customer: {
          customer_code: 'TEST_CUSTOMER',
          email: 'test@simulation.local',
        },
        authorization: {
          account_number: virtualAccount.account_number,
          bank: virtualAccount.bank_name,
        },
        channel: 'bank_transfer',
        paid_at: new Date().toISOString(),
        status: 'success',
        metadata: {
          simulation: true,
          simulated_by: user.id,
          simulated_at: new Date().toISOString(),
        },
      },
    };

    const { error: webhookLogError } = await supabase
      .from('paystack_webhook_events')
      .insert({
        event_type: 'charge.success',
        paystack_reference: testReference,
        payload: webhookPayload,
        signature_valid: true, // Simulated as valid
        processed: false,
      });

    if (webhookLogError) {
      console.error('Error logging webhook event:', webhookLogError);
    }

    console.log('Step 4: Webhook event logged');

    // Step 5: Create transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: student_id,
        wallet_id: wallet.id,
        type: 'credit',
        amount: amount,
        category: 'wallet_topup',
        description: `Test payment (Simulation) - ${virtualAccount.account_name}`,
        reference: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'completed',
        paystack_reference: testReference,
        payment_channel: 'simulation',
        webhook_data: webhookPayload.data,
        metadata: {
          simulation: true,
          simulated_by: user.id,
          simulated_at: new Date().toISOString(),
          virtual_account: virtualAccount.account_number,
          bank: virtualAccount.bank_name,
        },
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      
      // Mark webhook as failed
      await supabase
        .from('paystack_webhook_events')
        .update({ 
          processed: true, 
          error_message: transactionError.message 
        })
        .eq('paystack_reference', testReference);

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create transaction',
          step: 'transaction_creation',
          details: transactionError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Step 5: Transaction created - ${transaction.id}`);

    // Mark webhook as processed
    await supabase
      .from('paystack_webhook_events')
      .update({ processed: true })
      .eq('paystack_reference', testReference);

    console.log('Simulation completed successfully');

    // Return success with detailed flow information
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test payment simulated successfully',
        transaction_id: transaction.id,
        test_reference: testReference,
        amount: amount,
        student_id: student_id,
        flow_steps: [
          { step: 1, name: 'Virtual Account Found', status: 'completed', account: virtualAccount.account_number },
          { step: 2, name: 'Wallet Located', status: 'completed', wallet_id: wallet.id },
          { step: 3, name: 'Duplicate Check', status: 'completed' },
          { step: 4, name: 'Webhook Logged', status: 'completed', reference: testReference },
          { step: 5, name: 'Transaction Created', status: 'completed', transaction_id: transaction.id },
        ],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error simulating payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Simulation failed',
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
