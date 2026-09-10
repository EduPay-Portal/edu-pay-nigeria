// Wema VAS — Block Account API (vendor-hosted).
//
// PROVISIONAL: required by the onboarding checklist ("successful block returns
// success message only"; blocked accounts must then look up as inactive and
// stop receiving transactions). Wema has not published the schema, so field
// names follow the published endpoints' conventions and MUST be re-confirmed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, getRequestId, getRequestIp } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";
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
  const ip = getRequestIp(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: vasHeaders });
  if (req.method !== "POST") {
    return vasJson({ status: VAS_STATUS.INVALID, status_desc: "Method not allowed" }, 405);
  }

  const auth = checkVasBearer(req);
  if (!auth.ok) return unauthorizedResponse();

  const body = await readJson(req);
  const accountNumber = String(body?.accountnumber ?? body?.craccount ?? "").trim();
  const reason = String(body?.reason ?? "Blocked on Wema Bank request").trim();
  if (!accountNumber || !isOurAccountNumber(accountNumber)) return invalidAccountResponse();

  try {
    const supabase = adminClient();
    const { data: va } = await supabase
      .from("virtual_accounts")
      .select("id, student_id")
      .eq("account_number", accountNumber)
      .maybeSingle();

    if (!va) return invalidAccountResponse();

    const { error } = await supabase
      .from("virtual_accounts")
      .update({
        account_status: "blocked",
        is_active: false,
        status: "blocked",
        blocked_at: new Date().toISOString(),
        block_reason: reason,
      })
      .eq("id", va.id);

    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      actorId: null,
      action: "virtual_account.blocked",
      entityType: "virtual_account",
      entityId: va.id,
      requestId,
      ip,
      metadata: { source: "wema-block-account", account_number: accountNumber, reason },
    });

    logVas("wema-block-account", requestId, "account blocked", { accountNumber });

    return vasJson({ status: VAS_STATUS.SUCCESS, status_desc: "Account blocked successfully" });
  } catch (e) {
    console.error(`[wema-block-account] req=${requestId} error`, e instanceof Error ? e.message : e);
    return vasJson({ status: "96", status_desc: "Temporary processing error" }, 200);
  }
});
