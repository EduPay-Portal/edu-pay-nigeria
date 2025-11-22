import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number;
    customer: {
      customer_code: string;
      email: string;
    };
    authorization?: {
      account_number?: string;
      bank?: string;
    };
    channel: string;
    paid_at: string;
    status: string;
    metadata?: Record<string, any>;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Paystack webhook received');

    // Get signature from headers
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      console.error('Missing Paystack signature');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const bodyText = await req.text();
    
    // Verify webhook signature (CRITICAL SECURITY)
    const hash = createHmac('sha512', paystackSecretKey)
      .update(bodyText)
      .digest('hex');

    const signatureValid = hash === signature;

    if (!signatureValid) {
      console.error('Invalid Paystack signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signature verified successfully');

    // Parse the payload
    const payload: PaystackWebhookPayload = JSON.parse(bodyText);
    const { event, data } = payload;

    console.log(`Processing event: ${event}, reference: ${data.reference}`);

    // Log webhook event
    const { error: logError } = await supabase
      .from('paystack_webhook_events')
      .insert({
        event_type: event,
        paystack_reference: data.reference,
        payload: payload,
        signature_valid: signatureValid,
        processed: false,
      });

    if (logError) {
      console.error('Error logging webhook event:', logError);
    }

    // Handle charge.success event
    if (event === 'charge.success' && data.status === 'success') {
      console.log('Processing successful payment');

      // Get virtual account details
      const accountNumber = data.authorization?.account_number;
      
      if (!accountNumber) {
        console.error('No account number in webhook data');
        return new Response(
          JSON.stringify({ error: 'No account number provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find student by virtual account number
      const { data: virtualAccount, error: accountError } = await supabase
        .from('virtual_accounts')
        .select('id, student_id, account_name')
        .eq('account_number', accountNumber)
        .eq('is_active', true)
        .single();

      if (accountError || !virtualAccount) {
        console.error('Virtual account not found:', accountError);
        return new Response(
          JSON.stringify({ error: 'Virtual account not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Found virtual account for student: ${virtualAccount.student_id}`);

      // Get student's wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', virtualAccount.student_id)
        .single();

      if (walletError || !wallet) {
        console.error('Wallet not found:', walletError);
        return new Response(
          JSON.stringify({ error: 'Wallet not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Convert amount from kobo to naira
      const amountInNaira = data.amount / 100;

      // Generate idempotency key from Paystack reference
      const idempotencyKey = `paystack_${data.reference}`;

      // Check if transaction already exists (idempotency)
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('paystack_reference', data.reference)
        .single();

      if (existingTransaction) {
        console.log('Transaction already processed (duplicate webhook)');
        return new Response(
          JSON.stringify({ message: 'Transaction already processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: virtualAccount.student_id,
          wallet_id: wallet.id,
          type: 'credit',
          amount: amountInNaira,
          category: 'wallet_topup',
          description: `Payment received via virtual account (${accountNumber})`,
          reference: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'completed',
          paystack_reference: data.reference,
          payment_channel: data.channel,
          webhook_data: data,
          metadata: {
            customer_email: data.customer.email,
            paid_at: data.paid_at,
            bank: data.authorization?.bank,
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
          .eq('paystack_reference', data.reference);

        return new Response(
          JSON.stringify({ error: 'Failed to create transaction' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Transaction created successfully: ${transaction.id}`);

      // Mark webhook as processed
      await supabase
        .from('paystack_webhook_events')
        .update({ processed: true })
        .eq('paystack_reference', data.reference);

      return new Response(
        JSON.stringify({ 
          message: 'Payment processed successfully',
          transaction_id: transaction.id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle other events
    console.log(`Event ${event} received but not processed`);
    
    return new Response(
      JSON.stringify({ message: `Event ${event} received` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
