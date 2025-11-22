import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateVirtualAccountRequest {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface PaystackCustomerResponse {
  status: boolean;
  message: string;
  data: {
    customer_code: string;
    email: string;
    integration: number;
    domain: string;
    customer_id: number;
    identified: boolean;
    identifications: null;
    metadata: any;
  };
}

interface PaystackDVAResponse {
  status: boolean;
  message: string;
  data: {
    bank: {
      name: string;
      id: number;
      slug: string;
    };
    account_name: string;
    account_number: string;
    assigned: boolean;
    currency: string;
    metadata: any;
    active: boolean;
    id: number;
    created_at: string;
    updated_at: string;
    assignment: {
      integration: number;
      assignee_id: number;
      assignee_type: string;
      expired: boolean;
      account_type: string;
      assigned_at: string;
    };
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: any;
      risk_action: string;
    };
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
    // Verify authentication
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
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestBody: CreateVirtualAccountRequest = await req.json();
    const { student_id, first_name, last_name, email } = requestBody;

    console.log(`Creating virtual account for student: ${student_id}`);

    // Check if virtual account already exists
    const { data: existingAccount } = await supabase
      .from('virtual_accounts')
      .select('id, account_number, bank_name')
      .eq('student_id', student_id)
      .single();

    if (existingAccount) {
      console.log('Virtual account already exists');
      return new Response(
        JSON.stringify({ 
          message: 'Virtual account already exists',
          account: existingAccount 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Create Paystack customer
    console.log('Creating Paystack customer...');
    const customerResponse = await fetch('https://api.paystack.co/customer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        first_name,
        last_name,
        metadata: {
          student_id,
        },
      }),
    });

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text();
      console.error('Paystack customer creation failed:', errorText);
      throw new Error(`Failed to create Paystack customer: ${errorText}`);
    }

    const customerData: PaystackCustomerResponse = await customerResponse.json();
    
    if (!customerData.status) {
      throw new Error(`Paystack error: ${customerData.message}`);
    }

    const customerCode = customerData.data.customer_code;
    console.log(`Customer created: ${customerCode}`);

    // Step 2: Assign Dedicated Virtual Account
    console.log('Assigning dedicated virtual account...');
    const dvaResponse = await fetch('https://api.paystack.co/dedicated_account', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customerCode,
        preferred_bank: 'wema-bank', // Default to WEMA, can be made dynamic
      }),
    });

    if (!dvaResponse.ok) {
      const errorText = await dvaResponse.text();
      console.error('Paystack DVA creation failed:', errorText);
      throw new Error(`Failed to create dedicated virtual account: ${errorText}`);
    }

    const dvaData: PaystackDVAResponse = await dvaResponse.json();
    
    if (!dvaData.status) {
      throw new Error(`Paystack error: ${dvaData.message}`);
    }

    const { account_number, account_name, bank } = dvaData.data;
    console.log(`Virtual account created: ${account_number} (${bank.name})`);

    // Step 3: Save to database
    const { data: virtualAccount, error: dbError } = await supabase
      .from('virtual_accounts')
      .insert({
        student_id,
        paystack_customer_code: customerCode,
        account_number,
        account_name,
        bank_name: bank.name,
        bank_code: bank.id.toString(),
        is_active: true,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to save virtual account: ${dbError.message}`);
    }

    console.log('Virtual account saved to database successfully');

    return new Response(
      JSON.stringify({
        message: 'Virtual account created successfully',
        account: {
          account_number,
          account_name,
          bank_name: bank.name,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating virtual account:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
