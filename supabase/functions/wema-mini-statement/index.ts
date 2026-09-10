// Wema VAS — Fetch Mini Statement API (vendor-hosted).
//
// PROVISIONAL: the onboarding checklist requires this endpoint ("last 10 days
// transactions only", "credit and debit", "invalid account -> 07"), but Wema has
// not published its request/response schema. The shape below follows the naming
// conventions of the published endpoints and MUST be re-confirmed with Wema.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, getRequestId } from "../_shared/auth.ts";
import {
  checkVasBearer,
  invalidAccountResponse,
  isOurAccountNumber,
  logVas,
  readJson,
  unauthorizedResponse,
  VAS_DESC,
  VAS_STATUS,
  vasHeaders,
  vasJson,
} from "../_shared/payments/wema-vas.ts";

serve(async (req) => {
  const requestId = getRequestId(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: vasHeaders });
  if (req.method !== "POST") {
    return vasJson({ status: VAS_STATUS.INVALID, status_desc: "Method not allowed" }, 405);
  }

  const auth = checkVasBearer(req);
  if (!auth.ok) return unauthorizedResponse();

  const body = await readJson(req);
  const accountNumber = String(body?.accountnumber ?? body?.craccount ?? "").trim();
  if (!accountNumber || !isOurAccountNumber(accountNumber)) return invalidAccountResponse();

  try {
    const supabase = adminClient();
    const { data: va } = await supabase
      .from("virtual_accounts")
      .select("student_id, account_name")
      .eq("account_number", accountNumber)
      .maybeSingle();

    // Blocked/inactive accounts still return their existing records (per onboarding tests).
    if (!va) return invalidAccountResponse();

    const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("reference, session_id, amount, type, description, status, created_at")
      .eq("user_id", va.student_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    const rows = (txns ?? []).map((t) => ({
      transactionreference: t.reference,
      sessionid: t.session_id ?? "",
      amount: String(t.amount),
      type: t.type === "credit" ? "C" : "D",
      narration: t.description ?? "",
      status: t.status,
      transactiondate: t.created_at,
    }));

    logVas("wema-mini-statement", requestId, "returned statement", {
      accountNumber,
      count: rows.length,
    });

    return vasJson({
      status: VAS_STATUS.SUCCESS,
      status_desc: `${rows.length} Row(s) returned`,
      accountnumber: accountNumber,
      accountname: va.account_name,
      transactions: rows,
    });
  } catch (e) {
    console.error(`[wema-mini-statement] req=${requestId} error`, e instanceof Error ? e.message : e);
    return vasJson({ status: "96", status_desc: "Temporary processing error" }, 200);
  }
});
