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
    const BATCH_SIZE = 10;
    const DELAY_MS = 500;

    // Process in batches
    for (let i = 0; i < studentsToProcess.length; i += BATCH_SIZE) {
      const batch = studentsToProcess.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} students)`);

      const batchPromises = batch.map(async (student) => {
        const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
        
        if (!profile?.email || !profile?.first_name || !profile?.last_name) {
          return {
            student_id: student.user_id,
            success: false,
            error: 'Missing required profile data',
          };
        }

        try {
          // Create Paystack customer
          const customerResponse = await fetch('https://api.paystack.co/customer', {
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

          // Assign DVA
          const dvaResponse = await fetch('https://api.paystack.co/dedicated_account', {
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
            throw new Error(`DVA creation failed: ${errorText}`);
          }

          const dvaData: PaystackDVAResponse = await dvaResponse.json();
          if (!dvaData.status) {
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

          return {
            student_id: student.user_id,
            success: true,
            account_number,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error for student ${student.user_id}:`, errorMessage);
          return {
            student_id: student.user_id,
            success: false,
            error: errorMessage,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches (except for last batch)
      if (i + BATCH_SIZE < studentsToProcess.length) {
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
