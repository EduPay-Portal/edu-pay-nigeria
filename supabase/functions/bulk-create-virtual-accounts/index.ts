// Bulk virtual account creation — delegates to the provider-agnostic
// `dva-create` function (Wema Bank by default), one student at a time.
// Sequential processing with 2s delay and 3-attempt exponential backoff
// per project memory.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ProcessingResult {
  student_id: string;
  success: boolean;
  error?: string;
  account_number?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Starting bulk virtual account creation (Wema)...");

    const { data: students, error: queryError } = await supabase
      .from("student_profiles")
      .select(`
        user_id,
        profiles!student_profiles_user_id_fkey (
          first_name,
          last_name,
          email
        )
      `);

    if (queryError) throw queryError;
    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ message: "No students found", total: 0, successful: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: existingVAs } = await supabase
      .from("virtual_accounts")
      .select("student_id")
      .eq("is_active", true);

    const existingVAIds = new Set(existingVAs?.map((va) => va.student_id) || []);
    const toProcess = students.filter((s) => !existingVAIds.has(s.user_id));

    if (toProcess.length === 0) {
      return new Response(
        JSON.stringify({ message: "All students already have virtual accounts", total: 0, successful: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: ProcessingResult[] = [];
    const DELAY_MS = 2000;
    const MAX_RETRIES = 3;

    for (let i = 0; i < toProcess.length; i++) {
      const student = toProcess[i];
      const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;

      if (!profile?.email || !profile?.first_name || !profile?.last_name) {
        results.push({
          student_id: student.user_id,
          success: false,
          error: "Missing required profile data",
        });
        continue;
      }

      let attempt = 0;
      let ok = false;
      let lastErr = "";
      let accountNumber: string | undefined;

      while (attempt < MAX_RETRIES && !ok) {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/dva-create`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({
              student_id: student.user_id,
              first_name: profile.first_name,
              last_name: profile.last_name,
              email: profile.email,
              provider: "wema",
            }),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          const body = await res.json();
          accountNumber = body?.account?.account_number;
          ok = true;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          attempt++;
          if (attempt < MAX_RETRIES) {
            await sleep(1000 * Math.pow(2, attempt));
          }
        }
      }

      results.push(
        ok
          ? { student_id: student.user_id, success: true, account_number: accountNumber }
          : { student_id: student.user_id, success: false, error: lastErr },
      );

      if (i < toProcess.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const errors = results
      .filter((r) => !r.success)
      .map((r) => ({ student_id: r.student_id, error: r.error }));

    return new Response(
      JSON.stringify({
        message: "Bulk virtual account creation completed",
        total: toProcess.length,
        successful,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in bulk creation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
