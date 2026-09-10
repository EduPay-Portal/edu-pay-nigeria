// Wema VAS — 2. Transaction Notification API (vendor-hosted, called by Wema Bank).
// POST documented NIP inflow payload -> { transactionreference, status, status_desc }
// Duplicate notifications are keyed on `sessionid` and must still return "00".
// Spec: https://wemabank-doc.notion.site/2-Transaction-Notification-API-32013df490b6809d8cd4eda22f9abe41

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, getRequestId, getRequestIp } from "../_shared/auth.ts";
import {
  checkVasBearer,
  logVas,
  readJson,
  unauthorizedResponse,
  VAS_DESC,
  VAS_STATUS,
  vasHeaders,
  vasJson,
} from "../_shared/payments/wema-vas.ts";

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

/** Non-"00" tells the bank to retry later. */
const retryResponse = (desc: string) =>
  vasJson({ transactionreference: "", status: "96", status_desc: desc }, 200);

serve(async (req) => {
  const requestId = getRequestId(req);
  const ip = getRequestIp(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: vasHeaders });
  if (req.method !== "POST") {
    return vasJson({ transactionreference: "", status: VAS_STATUS.INVALID, status_desc: "Method not allowed" }, 405);
  }

  const auth = checkVasBearer(req);
  if (!auth.ok) {
    logVas("wema-transaction-notification", requestId, "unauthorized", { reason: auth.reason });
    return unauthorizedResponse();
  }

  const body = await readJson(req);
  if (!body) {
    return vasJson({ transactionreference: "", status: VAS_STATUS.INVALID, status_desc: "Invalid request payload" }, 400);
  }

  const sessionId = str(body.sessionid);
  const craccount = str(body.craccount);
  const amountRaw = str(body.amount);
  const paymentReference = str(body.paymentreference);
  const amount = Number(amountRaw);

  if (!sessionId || !craccount || !amountRaw || !Number.isFinite(amount) || amount <= 0) {
    logVas("wema-transaction-notification", requestId, "validation failed", {
      has_sessionid: !!sessionId,
      has_craccount: !!craccount,
      amount_valid: Number.isFinite(amount) && amount > 0,
    });
    return vasJson({
      transactionreference: "",
      status: VAS_STATUS.INVALID,
      status_desc: "Invalid request payload",
    }, 400);
  }

  const supabase = adminClient();

  try {
    // 1. Idempotency — same sessionId must never be processed twice.
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, reference")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existing) {
      logVas("wema-transaction-notification", requestId, "duplicate sessionid ignored", { sessionId });
      return vasJson({
        transactionreference: existing.reference,
        status: VAS_STATUS.SUCCESS,
        status_desc: "Duplicate notification acknowledged",
      });
    }

    // 2. Always log the inbound event (secrets never included).
    await supabase.from("webhook_events").insert({
      provider: "wema",
      event_type: "transaction.notification",
      provider_reference: paymentReference || sessionId,
      payload: body,
      signature_valid: true,
      ip_address: ip,
      processed: false,
    });

    // 3. Resolve the virtual account.
    const { data: va } = await supabase
      .from("virtual_accounts")
      .select("id, student_id, account_status, is_active")
      .eq("account_number", craccount)
      .eq("provider", "wema")
      .maybeSingle();

    if (!va) {
      await supabase.from("reconciliation_logs").insert({
        received_amount: amount,
        match_type: "unmatched",
        notes: `Wema notification for unknown account ${craccount} (session ${sessionId})`,
      });
      logVas("wema-transaction-notification", requestId, "unknown craccount", { craccount });
      return vasJson({
        transactionreference: "",
        status: VAS_STATUS.INVALID,
        status_desc: VAS_DESC.INVALID_ACCOUNT,
      });
    }

    if (va.account_status !== "active" || va.is_active === false) {
      await supabase.from("reconciliation_logs").insert({
        student_id: va.student_id,
        received_amount: amount,
        match_type: "unmatched",
        notes: `Wema notification for inactive account ${craccount} (session ${sessionId})`,
      });
      return vasJson({
        transactionreference: "",
        status: VAS_STATUS.INVALID,
        status_desc: VAS_DESC.INACTIVE_ACCOUNT,
      });
    }

    // 4. Wallet.
    const { data: wallet } = await supabase
      .from("wallets").select("id").eq("user_id", va.student_id).maybeSingle();

    if (!wallet) {
      await supabase.from("reconciliation_logs").insert({
        student_id: va.student_id,
        received_amount: amount,
        match_type: "unmatched",
        notes: `Student has no wallet (session ${sessionId})`,
      });
      // Our side is at fault — ask the bank to retry.
      return retryResponse("Unable to give value at this time");
    }

    // 5. Credit the wallet (trigger applies the balance change).
    const reference = `WEMA-${sessionId}`;
    const { data: txRow, error: txErr } = await supabase
      .from("transactions")
      .insert({
        user_id: va.student_id,
        wallet_id: wallet.id,
        type: "credit",
        amount,
        category: "wallet_topup",
        description: `Bank transfer from ${str(body.originatorname) || "unknown sender"}`,
        reference,
        session_id: sessionId,
        provider: "wema",
        provider_reference: paymentReference || sessionId,
        payment_channel: "bank_transfer",
        payment_method: "bank_transfer",
        status: "completed",
        payer_account_name: str(body.originatorname) || null,
        payer_account_number: str(body.originatoraccountnumber) || null,
        payer_bank: str(body.bankname) || null,
        match_status: "auto",
        nibss_response: VAS_STATUS.SUCCESS,
        send_response: VAS_STATUS.SUCCESS,
        webhook_data: body,
      })
      .select("id, reference")
      .single();

    if (txErr) {
      // Unique violation => a concurrent retry won the race; acknowledge it.
      if (txErr.code === "23505") {
        logVas("wema-transaction-notification", requestId, "concurrent duplicate", { sessionId });
        return vasJson({
          transactionreference: reference,
          status: VAS_STATUS.SUCCESS,
          status_desc: "Duplicate notification acknowledged",
        });
      }
      console.error(`[wema-transaction-notification] req=${requestId} insert failed:`, txErr.message);
      return retryResponse("Temporary processing error");
    }

    await supabase.from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("provider", "wema")
      .eq("provider_reference", paymentReference || sessionId);

    await supabase.from("reconciliation_logs").insert({
      transaction_id: txRow.id,
      student_id: va.student_id,
      received_amount: amount,
      match_type: "auto",
      notes: `Auto-matched via Wema VAS notification (session ${sessionId})`,
    });

    logVas("wema-transaction-notification", requestId, "processed", { sessionId, craccount });
    return vasJson({
      transactionreference: txRow.reference,
      status: VAS_STATUS.SUCCESS,
      status_desc: VAS_DESC.SUCCESS,
    });
  } catch (e) {
    console.error(`[wema-transaction-notification] req=${requestId} error`, e instanceof Error ? e.message : e);
    return retryResponse("Temporary processing error");
  }
});
