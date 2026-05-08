// Wema Bank webhook receiver.
// - Verifies HMAC signature via shared provider parser
// - Optional IP allowlist (WEMA_ALLOWED_IPS, comma-separated)
// - Idempotent via (provider, provider_reference) unique index
// - Inserts webhook_events, creates transaction, runs reconciliation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { wemaProvider } from "../_shared/payments/providers/wema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wema-signature, x-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";

  // IP allowlist
  const allow = (Deno.env.get("WEMA_ALLOWED_IPS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length > 0 && ip && !allow.includes(ip)) {
    console.warn(`[wema-webhook] blocked IP ${ip}`);
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const result = await wemaProvider.parseWebhook(rawBody, headers, ip);

  // Always log the attempt
  const logRow = {
    provider: "wema",
    event_type: result.event_type ?? "unknown",
    provider_reference: result.transaction?.provider_reference ?? null,
    payload: (() => { try { return JSON.parse(rawBody); } catch { return { raw: rawBody }; } })(),
    signature_valid: result.valid,
    ip_address: ip || null,
    processed: false,
    error_message: result.valid ? null : result.reason,
  };

  if (!result.valid) {
    await supabase.from("webhook_events").insert(logRow);
    return new Response(JSON.stringify({ error: result.reason }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tx = result.transaction!;

  // Idempotency: try insert; unique index will reject duplicates
  const { error: dupErr } = await supabase.from("webhook_events").insert(logRow);
  if (dupErr && dupErr.code === "23505") {
    console.log(`[wema-webhook] duplicate ${tx.provider_reference} — ignored`);
    return new Response(JSON.stringify({ message: "Duplicate ignored" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (tx.status !== "completed") {
    return new Response(JSON.stringify({ message: "Event noted (not completed)" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve student via account_number
  const { data: va } = await supabase
    .from("virtual_accounts")
    .select("student_id")
    .eq("account_number", tx.account_number ?? "")
    .eq("provider", "wema")
    .maybeSingle();

  if (!va) {
    await supabase.from("reconciliation_logs").insert({
      received_amount: tx.amount,
      match_type: "unmatched",
      notes: `No virtual_account for ${tx.account_number}`,
    });
    return new Response(JSON.stringify({ message: "Logged as unmatched" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find user wallet
  const { data: wallet } = await supabase
    .from("wallets").select("id").eq("user_id", va.student_id).maybeSingle();

  if (!wallet) {
    await supabase.from("reconciliation_logs").insert({
      student_id: va.student_id,
      received_amount: tx.amount,
      match_type: "unmatched",
      notes: "Student has no wallet",
    });
    return new Response(JSON.stringify({ message: "No wallet" }), { status: 200, headers: corsHeaders });
  }

  const { data: txRow, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: va.student_id,
      wallet_id: wallet.id,
      type: "credit",
      amount: tx.amount,
      category: "wallet_topup",
      description: `Wema bank transfer from ${tx.payer_account_name ?? "unknown"}`,
      reference: `WEMA-${tx.provider_reference}`,
      provider_reference: tx.provider_reference,
      provider: "wema",
      payment_channel: "bank_transfer",
      payment_method: "bank_transfer",
      status: "completed",
      payer_account_name: tx.payer_account_name,
      payer_account_number: tx.payer_account_number,
      payer_bank: tx.payer_bank,
      match_status: "auto",
      webhook_data: tx.raw,
    })
    .select()
    .single();

  if (txErr) {
    console.error("[wema-webhook] tx insert error", txErr);
    await supabase.from("webhook_events")
      .update({ error_message: txErr.message })
      .eq("provider", "wema").eq("provider_reference", tx.provider_reference);
    return new Response(JSON.stringify({ error: txErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("webhook_events")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("provider", "wema").eq("provider_reference", tx.provider_reference);

  await supabase.from("reconciliation_logs").insert({
    transaction_id: txRow.id,
    student_id: va.student_id,
    received_amount: tx.amount,
    match_type: "auto",
    notes: "Auto-matched via DVA account number",
  });

  return new Response(JSON.stringify({ message: "Processed", transaction_id: txRow.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
