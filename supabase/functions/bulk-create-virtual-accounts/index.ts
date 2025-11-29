import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaystackCustomerResponse {
  status: boolean;
  message: string;
  data: {
    customer_code: string;
  };
}

interface PaystackDVAResponse {
  status: boolean;
  message: string;
  data: {
    bank: { name: string; id: number };
    account_name: string;
    account_number: string;
  };
}

interface ProcessingResult {
  student_id: string;
  success: boolean;
  error?: string;
  account_number?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verify admin authentication
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

    // Verify admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting bulk virtual account creation...');

    // Fetch all students WITHOUT virtual accounts
    const { data: studentsWithoutVA, error: queryError } = await supabase
      .from('student_profiles')
      .select(`
        user_id,
        profiles!student_profiles_user_id_fkey (
          first_name,
          last_name,
          email
        )
      `);

    if (queryError) throw queryError;
    if (!studentsWithoutVA || studentsWithoutVA.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No students found', total: 0, successful: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out students who already have VAs
    const { data: existingVAs } = await supabase
      .from('virtual_accounts')
      .select('student_id');

    const existingVAIds = new Set(existingVAs?.map(va => va.student_id) || []);
    const studentsToProcess = studentsWithoutVA.filter(s => !existingVAIds.has(s.user_id));

    console.log(`Found ${studentsToProcess.length} students without virtual accounts`);

    if (studentsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All students already have virtual accounts', total: 0, successful: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: ProcessingResult[] = [];
    const DELAY_MS = 2000; // 2 seconds between each student
    const MAX_RETRIES = 3;

    // Helper function to retry with exponential backoff
    async function fetchWithRetry(url: string, options: any, retries = MAX_RETRIES): Promise<Response> {
      for (let i = 0; i <= retries; i++) {
        const response = await fetch(url, options);
        
        // If successful or non-retryable error, return immediately
        if (response.ok || response.status !== 429) {
          return response;
        }
        
        // Rate limited - wait with exponential backoff
        if (i < retries) {
          const backoffMs = Math.pow(2, i) * 2000; // 2s, 4s, 8s
          console.log(`Rate limited, waiting ${backoffMs}ms before retry ${i + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
      
      // If we exhausted retries, return the last response
      return fetch(url, options);
    }

    // Process students sequentially (one at a time)
    for (let i = 0; i < studentsToProcess.length; i++) {
      const student = studentsToProcess[i];
      console.log(`Processing student ${i + 1}/${studentsToProcess.length}: ${student.user_id}`);

      const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
      
      if (!profile?.email || !profile?.first_name || !profile?.last_name) {
        results.push({
          student_id: student.user_id,
          success: false,
          error: 'Missing required profile data',
        });
        continue;
      }

      try {
        // Create Paystack customer with retry
        const customerResponse = await fetchWithRetry('https://api.paystack.co/customer', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: profile.email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            metadata: { student_id: student.user_id },
          }),
        });

        if (!customerResponse.ok) {
          const errorText = await customerResponse.text();
          throw new Error(`Customer creation failed: ${errorText}`);
        }

        const customerData: PaystackCustomerResponse = await customerResponse.json();
        if (!customerData.status) {
          throw new Error(customerData.message);
        }

        const customerCode = customerData.data.customer_code;

        // Small delay before DVA creation
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Assign DVA with retry
        const dvaResponse = await fetchWithRetry('https://api.paystack.co/dedicated_account', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: customerCode,
            preferred_bank: 'wema-bank',
          }),
        });

        if (!dvaResponse.ok) {
          const errorText = await dvaResponse.text();
          
          // Check if it's a "feature unavailable" error
          if (errorText.includes('feature_unavailable')) {
            throw new Error('FEATURE_UNAVAILABLE: Virtual accounts not enabled on Paystack account');
          }
          
          throw new Error(`DVA creation failed: ${errorText}`);
        }

        const dvaData: PaystackDVAResponse = await dvaResponse.json();
        if (!dvaData.status) {
          if (dvaData.message.includes('not available')) {
            throw new Error('FEATURE_UNAVAILABLE: Virtual accounts not enabled on Paystack account');
          }
          throw new Error(dvaData.message);
        }

        const { account_number, account_name, bank } = dvaData.data;

        // Save to database
        const { error: dbError } = await supabase
          .from('virtual_accounts')
          .insert({
            student_id: student.user_id,
            paystack_customer_code: customerCode,
            account_number,
            account_name,
            bank_name: bank.name,
            bank_code: bank.id.toString(),
            is_active: true,
          });

        if (dbError) throw new Error(`DB error: ${dbError.message}`);

        console.log(`✅ Created VA for student ${student.user_id}: ${account_number}`);
        results.push({
          student_id: student.user_id,
          success: true,
          account_number,
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error for student ${student.user_id}:`, errorMessage);
        results.push({
          student_id: student.user_id,
          success: false,
          error: errorMessage,
        });
        
        // If feature unavailable, stop processing all students
        if (errorMessage.includes('FEATURE_UNAVAILABLE')) {
          console.error('⚠️ Virtual accounts feature not available. Stopping bulk creation.');
          break;
        }
      }

      // Delay before next student (except for last one)
      if (i < studentsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const errors = results.filter(r => !r.success).map(r => ({
      student_id: r.student_id,
      error: r.error,
    }));

    console.log(`Bulk creation complete. Successful: ${successful}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        message: 'Bulk virtual account creation completed',
        total: studentsToProcess.length,
        successful,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk creation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
