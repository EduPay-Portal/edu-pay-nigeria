import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, processChargeSuccess } from "../_shared/process-payment.ts";
import { corsHeaders, requireAdmin } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();
  const guard = await requireAdmin(req, supabase);
  if (guard instanceof Response) return guard;
  const { actorId, requestId, ip } = guard;

  try {
    const body = await req.json();
    const { student_id, amount } = body as { student_id?: string; amount?: number };

    if (!student_id || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid student_id or amount", request_id: requestId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `TEST_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const { data: va } = await supabase
      .from("virtual_accounts")
      .select("account_number, account_name, bank_name")
      .eq("student_id", student_id).eq("is_active", true).maybeSingle();

    const synthetic = {
      event: "charge.success",
      data: {
        reference, amount: amount * 100,
        channel: va ? "dedicated_nuban" : "card",
        authorization: { account_number: va?.account_number ?? null, bank: va?.bank_name ?? null },
        metadata: { student_id, simulation: true, simulated_by: actorId },
        status: "success", paid_at: new Date().toISOString(),
      },
    };
    await supabase.from("paystack_webhook_events").insert({
      event_type: "charge.success", paystack_reference: reference,
      payload: synthetic, signature_valid: true, processed: false,
    });

    const result = await processChargeSuccess({
      reference, amountKobo: amount * 100, channel: synthetic.data.channel,
      accountNumber: va?.account_number ?? null, studentId: student_id,
      metadata: { simulation: true, simulated_by: actorId },
      webhookData: synthetic.data, source: "simulation", simulatedBy: actorId!,
    });

    await supabase.from("paystack_webhook_events").update({
      processed: true, processed_at: new Date().toISOString(),
      error_message: result.ok ? null : JSON.stringify(result.body),
    }).eq("paystack_reference", reference);

    await writeAudit(supabase, {
      actorId, action: "payment.simulate", entityType: "transaction", entityId: reference,
      requestId, ip, metadata: { student_id, amount, ok: result.ok },
    });

    return new Response(
      JSON.stringify({ success: result.ok, test_reference: reference, request_id: requestId, ...result.body }),
      { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("simulate-payment error:", err, "request_id=", requestId);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Simulation failed", details: message, request_id: requestId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
