// Bulk virtual account creation — delegates to the provider-agnostic
// `dva-create` function (Wema Bank by default), one student at a time.
// Sequential processing with 2s delay and 3-attempt exponential backoff
// per project memory.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, requireAdmin } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

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
  const supabase = adminClient();

  const guard = await requireAdmin(req, supabase);
  if (guard instanceof Response) return guard;
  const { actorId, requestId, ip } = guard;
  const authHeader = req.headers.get("Authorization")!;

  try {
    await writeAudit(supabase, {
      actorId, action: "bulk_create_virtual_accounts.invoked", requestId, ip,
    });
    console.log(`[bulk-create-vas] req=${requestId} starting...`);

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
              "x-request-id": requestId,
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

    await writeAudit(supabase, {
      actorId, action: "bulk_create_virtual_accounts.completed", requestId, ip,
      metadata: { total: toProcess.length, successful, failed },
    });

    return new Response(
      JSON.stringify({
        message: "Bulk virtual account creation completed",
        total: toProcess.length,
        successful,
        failed,
        errors: errors.length > 0 ? errors : undefined,
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in bulk creation:", error, "request_id=", requestId);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
