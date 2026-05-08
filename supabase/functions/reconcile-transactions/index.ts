// Manual reconciliation helpers — admin-only.
// - GET (no body): returns counts of unmatched / over / under / duplicate / orphaned
// - POST { action: 'manual_match', transaction_id, student_id, notes }: creates manual match log
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles?.some((r: any) => r.role === "admin")) {
    return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers: corsHeaders });
  }

  if (req.method === "GET") {
    const { data: counts } = await supabase
      .from("reconciliation_logs")
      .select("match_type");
    const summary: Record<string, number> = {};
    (counts ?? []).forEach((r: any) => (summary[r.match_type] = (summary[r.match_type] || 0) + 1));
    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "manual_match") {
    const { transaction_id, student_id, notes } = body;
    const { error } = await supabase.from("reconciliation_logs").insert({
      transaction_id, student_id, match_type: "manual",
      notes: notes ?? "Manual reconciliation",
      resolved_by: user.id, resolved_at: new Date().toISOString(),
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

    if (transaction_id) {
      await supabase.from("transactions")
        .update({ match_status: "manual", user_id: student_id })
        .eq("id", transaction_id);
    }
    await supabase.from("audit_logs").insert({
      actor_id: user.id, action: "reconciliation.manual_match",
      entity_type: "transaction", entity_id: transaction_id,
      after: { student_id, notes },
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
});
