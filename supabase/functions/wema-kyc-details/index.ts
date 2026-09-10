// Wema VAS — Get KYC Details API (vendor-hosted).
//
// PROVISIONAL: required by the onboarding checklist (account name, phone,
// bvn/nin, wallet balance, account status), but the exact schema is not
// published by Wema. Field names follow the published endpoints' conventions
// and MUST be re-confirmed with Wema before go-live.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, getRequestId } from "../_shared/auth.ts";
import {
  checkVasBearer,
  formatAccountName,
  identityFor,
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
      .select("student_id, account_name, account_status, is_active")
      .eq("account_number", accountNumber)
      .maybeSingle();

    if (!va) return invalidAccountResponse();

    const [{ data: profile }, { data: wallet }] = await Promise.all([
      supabase.from("student_profiles").select("bvn, nin, phone").eq("user_id", va.student_id).maybeSingle(),
      supabase.from("wallets").select("balance").eq("user_id", va.student_id).maybeSingle(),
    ]);

    const p = profile as { bvn?: string; nin?: string; phone?: string } | null;
    const { bvn, nin } = identityFor(p?.bvn, p?.nin);

    const accountName = va.account_name?.includes("/")
      ? va.account_name
      : formatAccountName(va.account_name ?? "Student");

    const active = va.account_status === "active" && va.is_active !== false;

    logVas("wema-kyc-details", requestId, "returned kyc", { accountNumber, active });

    // Inactive/blocked accounts still return KYC details (per onboarding tests).
    return vasJson({
      status: VAS_STATUS.SUCCESS,
      status_desc: VAS_DESC.SUCCESS,
      accountnumber: accountNumber,
      accountname: accountName,
      phonenumber: p?.phone ?? "",
      bvn,
      nin,
      walletbalance: String(wallet?.balance ?? 0),
      accountstatus: active ? "active" : "inactive",
    });
  } catch (e) {
    console.error(`[wema-kyc-details] req=${requestId} error`, e instanceof Error ? e.message : e);
    return vasJson({ status: "96", status_desc: "Temporary processing error" }, 200);
  }
});
