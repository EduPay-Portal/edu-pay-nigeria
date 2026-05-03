import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { adminClient, processChargeSuccess } from "../_shared/process-payment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!PAYSTACK_SECRET_KEY) {
    console.error("PAYSTACK_SECRET_KEY missing");
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = adminClient();

  try {
    const signature = req.headers.get("x-paystack-signature");
    const bodyText = await req.text();

    const hash = createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(bodyText)
      .digest("hex");
    const signatureValid = !!signature && hash === signature;

    if (!signatureValid) {
      console.error("Invalid Paystack signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = JSON.parse(bodyText);
    const { event, data } = payload;
    console.log(`paystack-webhook: event=${event} ref=${data?.reference}`);

    // Audit log
    await supabase.from("paystack_webhook_events").insert({
      event_type: event,
      paystack_reference: data?.reference ?? null,
      payload,
      signature_valid: true,
      processed: false,
    });

    if (event !== "charge.success" || data?.status !== "success") {
      await supabase
        .from("paystack_webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("paystack_reference", data?.reference);
      return new Response(
        JSON.stringify({ message: `Event ${event} acknowledged` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Strict resolution order — handled inside processChargeSuccess
    const result = await processChargeSuccess({
      reference: data.reference,
      amountKobo: data.amount,
      channel: data.channel,
      accountNumber: data.authorization?.account_number ?? null,
      studentId: data.metadata?.student_id ?? null,
      metadata: data.metadata ?? {},
      webhookData: data,
      source: "webhook",
    });

    await supabase
      .from("paystack_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: result.ok ? null : JSON.stringify(result.body),
      })
      .eq("paystack_reference", data.reference);

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paystack-webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
