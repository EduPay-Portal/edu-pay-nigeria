// Manual reconciliation helpers — admin-only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, requireAdmin } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();
  const guard = await requireAdmin(req, supabase);
  if (guard instanceof Response) return guard;
  const { actorId, requestId, ip } = guard;

  if (req.method === "GET") {
    const { data: counts } = await supabase.from("reconciliation_logs").select("match_type");
    const summary: Record<string, number> = {};
    (counts ?? []).forEach((r: any) => (summary[r.match_type] = (summary[r.match_type] || 0) + 1));
    return new Response(JSON.stringify({ summary, request_id: requestId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "manual_match") {
    const { transaction_id, student_id, notes } = body;
    const { error } = await supabase.from("reconciliation_logs").insert({
      transaction_id, student_id, match_type: "manual",
      notes: notes ?? "Manual reconciliation",
      resolved_by: actorId, resolved_at: new Date().toISOString(),
    });
    if (error) return new Response(JSON.stringify({ error: error.message, request_id: requestId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    if (transaction_id) {
      await supabase.from("transactions")
        .update({ match_status: "manual", user_id: student_id })
        .eq("id", transaction_id);
    }
    await writeAudit(supabase, {
      actorId, action: "reconciliation.manual_match",
      entityType: "transaction", entityId: transaction_id,
      requestId, ip, after: { student_id, notes },
    });
    return new Response(JSON.stringify({ ok: true, request_id: requestId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action", request_id: requestId }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
