import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StagingRecord {
  "SN": string;
  "NAMES": string;
  "SURNAME": string;
  "CLASS": string;
  "REG NO": string;
  "MEMBER/NMEMBER": string;
  "DAY/BOARDER": string;
  "SCHOOL FEES": string;
  "DEBTS": string;
  parent_email: string;
  parent_uuid?: string;
  student_uuid?: string;
  processed: boolean;
  processing_error?: string;
  created_at: string;
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
      .order('created_at', { ascending: true });

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
      errors: [] as Array<{ sn: string; error: string }>,
      created_students: [] as Array<{ sn: string; student_id: string; email: string; password: string }>,
    };

    // Track created parents to avoid duplicates
    const parentCache = new Map<string, string>();

    for (const record of stagingRecords as StagingRecord[]) {
      try {
        const sn = record["SN"];
        const names = record["NAMES"];
        const surname = record["SURNAME"];
        const classLevel = record["CLASS"];
        const regNo = record["REG NO"];
        const schoolFees = parseFloat(record["SCHOOL FEES"] || "0") || 0;
        const debt = parseFloat(record["DEBTS"] || "0") || 0;
        const membershipStatus = record["MEMBER/NMEMBER"] === "MEMBER" ? "MEMBER" : "NON_MEMBER";
        const boardingStatus = record["DAY/BOARDER"] === "BOARDER" ? "BOARDER" : "DAY";
        
        // Derive parent fields from surname
        const parentName = `${surname} Family`;
        const parentPhone = "08000000000"; // Placeholder
        
        console.log(`Processing SN ${sn}: ${surname}, ${names}`);

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
              const parentNames = parentName.split(' ');
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

              // Wait for trigger to create parent_profile
              await new Promise(resolve => setTimeout(resolve, 200));

              // Check if parent_profile exists, then update or insert
              const { data: existingParentProfile } = await supabaseAdmin
                .from('parent_profiles')
                .select('id')
                .eq('user_id', parentUserId)
                .maybeSingle();

              if (existingParentProfile) {
                await supabaseAdmin
                  .from('parent_profiles')
                  .update({ emergency_contact: parentPhone })
                  .eq('user_id', parentUserId);
              } else {
                await supabaseAdmin
                  .from('parent_profiles')
                  .insert({
                    user_id: parentUserId,
                    emergency_contact: parentPhone,
                    notification_preference: 'email',
                  });
              }

              console.log(`  Created parent account: ${record.parent_email}`);
            }
          }
        }

        // Step 2: Create student account
        const studentFirstName = names;
        const studentLastName = surname;
        const studentEmail = `${regNo.toLowerCase()}@edupay.school`.replace(/\s+/g, '');
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

        // Step 3: Wait for database triggers to create student_profile, then update/insert
        // Wait 200ms for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check if student_profile was created by trigger
        const { data: existingProfile } = await supabaseAdmin
          .from('student_profiles')
          .select('id')
          .eq('user_id', studentUserId)
          .maybeSingle();

        const profileData = {
          admission_number: regNo,
          class_level: classLevel,
          parent_id: parentUserId,
          registration_number: regNo,
          school_fees: schoolFees,
          debt_balance: debt,
          membership_status: membershipStatus,
          boarding_status: boardingStatus,
        };

        if (existingProfile) {
          // Update existing profile created by trigger
          const { data: updatedProfile, error: updateError } = await supabaseAdmin
            .from('student_profiles')
            .update(profileData)
            .eq('user_id', studentUserId)
            .select('id')
            .single();

          if (updateError) {
            console.error(`  Error updating student profile: ${updateError.message}`);
            throw new Error(`Profile update failed: ${updateError.message}`);
          }

          if (!updatedProfile) {
            console.warn(`  Warning: Update returned no data for student ${studentEmail}`);
            throw new Error(`Profile update affected 0 rows`);
          }

          console.log(`  Updated existing student profile`);
        } else {
          // Trigger didn't create profile - insert directly
          const { error: insertError } = await supabaseAdmin
            .from('student_profiles')
            .insert({
              user_id: studentUserId,
              ...profileData,
            });

          if (insertError) {
            console.error(`  Error inserting student profile: ${insertError.message}`);
            throw new Error(`Profile insert failed: ${insertError.message}`);
          }

          console.log(`  Inserted student profile directly`);
        }

        // Step 4: Create debt transaction if applicable
        if (debt && debt > 0) {
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
                amount: debt,
                category: 'fee_payment',
                description: `Outstanding debt from import - SN ${sn}`,
                reference: `DEBT-${regNo}-${Date.now()}`,
                status: 'pending',
                metadata: {
                  sn: sn,
                  source: 'bulk_import',
                },
              });
            
            console.log(`  Created debt transaction: ₦${debt}`);
          }
        }

        // Step 5: Mark staging record as processed
        await supabaseAdmin
          .from('students_import_staging')
          .update({
            processed: true,
            student_uuid: studentUserId,
            parent_uuid: parentUserId,
            processing_error: null,
          })
          .eq('"SN"', sn);

        results.success_count++;
        results.created_students.push({
          sn: sn,
          student_id: studentUserId,
          email: studentEmail,
          password: studentPassword,
        });

        console.log(`  ✓ Successfully processed SN ${sn}`);

      } catch (error) {
        const sn = record["SN"];
        console.error(`  ✗ Error processing SN ${sn}:`, error);
        
        // Mark as error in staging
        await supabaseAdmin
          .from('students_import_staging')
          .update({
            processed: false,
            processing_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('"SN"', sn);

        results.error_count++;
        results.errors.push({
          sn: sn,
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
