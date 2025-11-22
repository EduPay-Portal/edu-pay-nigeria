import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StagingRecord {
  id: string;
  sn: number;
  names: string;
  surname: string;
  class_level: string;
  reg_no: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  debt: number;
  is_member: boolean;
  is_boarder: boolean;
  import_batch_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { mode = 'all' } = await req.json();

    console.log(`Starting bulk create students - mode: ${mode}`);

    // Fetch pending staging records
    const { data: stagingRecords, error: fetchError } = await supabaseAdmin
      .from('students_import_staging')
      .select('*')
      .eq('processed', false)
      .order('sn', { ascending: true });

    if (fetchError) {
      console.error('Error fetching staging records:', fetchError);
      throw fetchError;
    }

    if (!stagingRecords || stagingRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success_count: 0, 
          error_count: 0, 
          message: 'No pending records to process' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${stagingRecords.length} pending records`);

    const results = {
      success_count: 0,
      error_count: 0,
      errors: [] as Array<{ sn: number; error: string }>,
      created_students: [] as Array<{ sn: number; student_id: string; email: string; password: string }>,
    };

    // Track created parents to avoid duplicates
    const parentCache = new Map<string, string>();

    for (const record of stagingRecords as StagingRecord[]) {
      try {
        console.log(`Processing SN ${record.sn}: ${record.surname}, ${record.names}`);

        // Step 1: Check or create parent account
        let parentUserId: string | null = null;

        if (record.parent_email) {
          // Check cache first
          if (parentCache.has(record.parent_email.toLowerCase())) {
            parentUserId = parentCache.get(record.parent_email.toLowerCase())!;
            console.log(`  Using cached parent: ${record.parent_email}`);
          } else {
            // Check if parent already exists
            const { data: existingParent } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('email', record.parent_email.toLowerCase())
              .maybeSingle();

            if (existingParent) {
              parentUserId = existingParent.id;
              if (parentUserId) {
                parentCache.set(record.parent_email.toLowerCase(), parentUserId);
              }
              console.log(`  Found existing parent: ${record.parent_email}`);
            } else {
              // Create parent account
              const parentNames = record.parent_name.split(' ');
              const parentFirstName = parentNames[0];
              const parentLastName = parentNames.slice(1).join(' ') || parentFirstName;
              const parentPassword = `Parent${Math.random().toString(36).slice(2, 10)}!`;

              const { data: parentAuth, error: parentAuthError } = await supabaseAdmin.auth.admin.createUser({
                email: record.parent_email.toLowerCase(),
                password: parentPassword,
                email_confirm: true,
                user_metadata: {
                  first_name: parentFirstName,
                  last_name: parentLastName,
                  role: 'parent',
                },
              });

              if (parentAuthError) {
                console.error(`  Error creating parent auth: ${parentAuthError.message}`);
                throw new Error(`Parent auth failed: ${parentAuthError.message}`);
              }

              parentUserId = parentAuth.user.id;
              parentCache.set(record.parent_email.toLowerCase(), parentUserId);

              // Update parent profile with import flag
              await supabaseAdmin
                .from('parent_profiles')
                .update({ 
                  created_from_import: true,
                  emergency_contact: record.parent_phone,
                })
                .eq('user_id', parentUserId);

              console.log(`  Created parent account: ${record.parent_email}`);
            }
          }
        }

        // Step 2: Create student account
        const studentFirstName = record.names;
        const studentLastName = record.surname;
        const studentEmail = `${record.reg_no.toLowerCase()}@edupay.school`.replace(/\s+/g, '');
        const studentPassword = `Student${Math.random().toString(36).slice(2, 10)}!`;

        const { data: studentAuth, error: studentAuthError } = await supabaseAdmin.auth.admin.createUser({
          email: studentEmail,
          password: studentPassword,
          email_confirm: true,
          user_metadata: {
            first_name: studentFirstName,
            last_name: studentLastName,
            role: 'student',
          },
        });

        if (studentAuthError) {
          console.error(`  Error creating student auth: ${studentAuthError.message}`);
          throw new Error(`Student auth failed: ${studentAuthError.message}`);
        }

        const studentUserId = studentAuth.user.id;
        console.log(`  Created student account: ${studentEmail}`);

        // Step 3: Update student profile with additional data
        const { error: profileUpdateError } = await supabaseAdmin
          .from('student_profiles')
          .update({
            admission_number: record.reg_no,
            class_level: record.class_level,
            parent_id: parentUserId,
            created_from_import: true,
            import_batch_id: record.import_batch_id,
            debt: record.debt,
            is_member: record.is_member,
            is_boarder: record.is_boarder,
            import_notes: `Imported from bulk upload. SN: ${record.sn}`,
          })
          .eq('user_id', studentUserId);

        if (profileUpdateError) {
          console.error(`  Error updating student profile: ${profileUpdateError.message}`);
          throw new Error(`Profile update failed: ${profileUpdateError.message}`);
        }

        // Step 4: Create debt transaction if applicable
        if (record.debt && record.debt > 0) {
          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', studentUserId)
            .single();

          if (wallet) {
            await supabaseAdmin
              .from('transactions')
              .insert({
                user_id: studentUserId,
                wallet_id: wallet.id,
                type: 'debit',
                amount: record.debt,
                category: 'fee_payment',
                description: `Outstanding debt from import - SN ${record.sn}`,
                reference: `DEBT-${record.reg_no}-${Date.now()}`,
                status: 'pending',
                metadata: {
                  import_batch_id: record.import_batch_id,
                  sn: record.sn,
                },
              });
            
            console.log(`  Created debt transaction: ₦${record.debt}`);
          }
        }

        // Step 5: Mark staging record as processed
        await supabaseAdmin
          .from('students_import_staging')
          .update({
            processed: true,
            student_uuid: studentUserId,
            parent_uuid: parentUserId,
            processed_at: new Date().toISOString(),
            processing_error: null,
          })
          .eq('id', record.id);

        results.success_count++;
        results.created_students.push({
          sn: record.sn,
          student_id: studentUserId,
          email: studentEmail,
          password: studentPassword,
        });

        console.log(`  ✓ Successfully processed SN ${record.sn}`);

      } catch (error) {
        console.error(`  ✗ Error processing SN ${record.sn}:`, error);
        
        // Mark as error in staging
        await supabaseAdmin
          .from('students_import_staging')
          .update({
            processed: false,
            processing_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', record.id);

        results.error_count++;
        results.errors.push({
          sn: record.sn,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Bulk create complete: ${results.success_count} success, ${results.error_count} errors`);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Fatal error in bulk-create-students:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success_count: 0,
        error_count: 0,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
