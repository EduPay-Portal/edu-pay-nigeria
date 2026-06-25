// Shared payment processor — used by `simulate-payment` (and any future
// provider-specific webhook that needs the same idempotent ledger logic).
//
// Wallet balance is NEVER mutated here — a database trigger
// (`apply_transaction_to_wallet`) handles that on transaction insert.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface ProcessChargeInput {
  reference: string;          // Provider reference (or TEST_… for simulation)
  amountKobo: number;         // Always kobo; converted to naira here
  channel?: string | null;    // e.g. 'card','bank','dedicated_nuban'
  accountNumber?: string | null;  // Preferred resolver: DVA path
  studentId?: string | null;      // Fallback resolver: metadata path
  metadata?: Record<string, unknown>;
  webhookData?: Record<string, unknown>;
  source: "webhook" | "simulation";
  simulatedBy?: string;
}

export interface ProcessChargeResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
  transactionId?: string;
  resolutionPath?: "account_number" | "metadata_student_id";
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function paymentMethodFor(input: ProcessChargeInput): "card" | "bank_transfer" | "simulation" {
  if (input.source === "simulation") return "simulation";
  if (input.channel === "card") return "card";
  return "bank_transfer";
}

/**
 * Idempotently process a successful charge.
 * Strict student resolution order:
 *   1. accountNumber → virtual_accounts (active)
 *   2. studentId (from metadata)
 *   3. reject
 */
export async function processChargeSuccess(
  input: ProcessChargeInput,
): Promise<ProcessChargeResult> {
  const supabase = adminClient();
  const { reference, amountKobo } = input;

  if (!reference) {
    return { ok: false, status: 400, body: { error: "Missing reference" } };
  }
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    return { ok: false, status: 400, body: { error: "Invalid amount" } };
  }

  // 1. Idempotency pre-check (column kept as paystack_reference for legacy compatibility)
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      status: 200,
      body: { message: "Transaction already processed", transaction_id: existing.id },
      transactionId: existing.id,
    };
  }

  // 2. Resolve student
  let studentId: string | null = null;
  let virtualAccountId: string | null = null;
  let resolutionPath: ProcessChargeResult["resolutionPath"] | undefined;

  if (input.accountNumber) {
    const { data: va } = await supabase
      .from("virtual_accounts")
      .select("id, student_id")
      .eq("account_number", input.accountNumber)
      .eq("is_active", true)
      .maybeSingle();
    if (va) {
      studentId = va.student_id;
      virtualAccountId = va.id;
      resolutionPath = "account_number";
    }
  }

  if (!studentId && input.studentId) {
    const { data: w } = await supabase
      .from("wallets")
      .select("user_id")
      .eq("user_id", input.studentId)
      .maybeSingle();
    if (w) {
      studentId = w.user_id;
      resolutionPath = "metadata_student_id";
    }
  }

  if (!studentId) {
    return {
      ok: false,
      status: 404,
      body: {
        error: "Unable to resolve student",
        tried: {
          account_number: input.accountNumber ?? null,
          metadata_student_id: input.studentId ?? null,
        },
      },
    };
  }

  // 3. Look up wallet
  const { data: wallet, error: walletErr } = await supabase
    .from("wallets")
    .select("id")
    .eq("user_id", studentId)
    .single();

  if (walletErr || !wallet) {
    return { ok: false, status: 404, body: { error: "Wallet not found", student_id: studentId } };
  }

  // 4. Insert transaction (DB trigger will credit wallet)
  const amountNaira = amountKobo / 100;
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: studentId,
      wallet_id: wallet.id,
      type: "credit",
      amount: amountNaira,
      category: "wallet_topup",
      description: input.source === "simulation"
        ? "Test payment (simulation)"
        : `Payment received via ${paymentMethodFor(input)}`,
      reference: `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      status: "completed",
      paystack_reference: reference, // legacy column name; stores provider reference for any provider
      provider_reference: reference,
      payment_channel: input.channel ?? null,
      payment_method: paymentMethodFor(input),
      provider: "wema",
      webhook_data: input.webhookData ?? null,
      metadata: {
        source: input.source,
        resolution_path: resolutionPath,
        virtual_account_id: virtualAccountId,
        simulated_by: input.simulatedBy,
        ...input.metadata,
      },
    })
    .select("id")
    .single();

  if (txErr) {
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to create transaction", details: txErr.message },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      message: "Payment processed successfully",
      transaction_id: tx.id,
      student_id: studentId,
      amount: amountNaira,
      resolution_path: resolutionPath,
    },
    transactionId: tx.id,
    resolutionPath,
  };
}
