import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, processChargeSuccess } from "../_shared/process-payment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = adminClient();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin gate via has_role (RPC)
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { student_id, amount } = body as { student_id?: string; amount?: number };

    if (!student_id || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid student_id or amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `TEST_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Look up the student's VA so the simulator exercises the same DVA path as live
    const { data: va } = await supabase
      .from("virtual_accounts")
      .select("account_number, account_name, bank_name")
      .eq("student_id", student_id)
      .eq("is_active", true)
      .maybeSingle();

    // Audit-log a synthetic webhook event for traceability
    const synthetic = {
      event: "charge.success",
      data: {
        reference,
        amount: amount * 100,
        channel: va ? "dedicated_nuban" : "card",
        authorization: { account_number: va?.account_number ?? null, bank: va?.bank_name ?? null },
        metadata: { student_id, simulation: true, simulated_by: user.id },
        status: "success",
        paid_at: new Date().toISOString(),
      },
    };
    await supabase.from("paystack_webhook_events").insert({
      event_type: "charge.success",
      paystack_reference: reference,
      payload: synthetic,
      signature_valid: true,
      processed: false,
    });

    const result = await processChargeSuccess({
      reference,
      amountKobo: amount * 100,
      channel: synthetic.data.channel,
      accountNumber: va?.account_number ?? null,
      studentId: student_id,
      metadata: { simulation: true, simulated_by: user.id },
      webhookData: synthetic.data,
      source: "simulation",
      simulatedBy: user.id,
    });

    await supabase
      .from("paystack_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: result.ok ? null : JSON.stringify(result.body),
      })
      .eq("paystack_reference", reference);

    return new Response(
      JSON.stringify({
        success: result.ok,
        test_reference: reference,
        ...result.body,
      }),
      {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("simulate-payment error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Simulation failed", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
