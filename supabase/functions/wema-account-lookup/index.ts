// Wema VAS — 1. Account Lookup API (vendor-hosted, called by Wema Bank).
// POST { "accountnumber": "7110234567" }
// -> { accountname, status, status_desc, bvn, nin }  (+ amount for dynamic accounts)
// Spec: https://wemabank-doc.notion.site/1-Account-Lookup-API-32013df490b680efb676d4120a07d387

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, getRequestId } from "../_shared/auth.ts";
import {
  checkVasBearer,
  formatAccountName,
  identityFor,
  inactiveAccountResponse,
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
  if (!auth.ok) {
    logVas("wema-account-lookup", requestId, "unauthorized", { reason: auth.reason });
    return unauthorizedResponse();
  }

  const body = await readJson(req);
  const accountNumber = String(body?.accountnumber ?? body?.accountNumber ?? "").trim();

  if (!accountNumber) {
    logVas("wema-account-lookup", requestId, "missing accountnumber");
    return invalidAccountResponse();
  }
  if (!isOurAccountNumber(accountNumber)) {
    logVas("wema-account-lookup", requestId, "prefix/format mismatch", { accountNumber });
    return invalidAccountResponse();
  }

  try {
    const supabase = adminClient();

    const { data: va, error } = await supabase
      .from("virtual_accounts")
      .select("student_id, account_name, account_status, status, is_active")
      .eq("account_number", accountNumber)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!va) {
      logVas("wema-account-lookup", requestId, "not found", { accountNumber });
      return invalidAccountResponse();
    }

    // Student identity (BVN/NIN live on the student profile when captured).
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("bvn, nin")
      .eq("user_id", va.student_id)
      .maybeSingle();

    const { bvn, nin } = identityFor(
      (profile as { bvn?: string } | null)?.bvn,
      (profile as { nin?: string } | null)?.nin,
    );

    if (!bvn && !nin) {
      // The spec requires at least one. Fail closed rather than return an
      // unusable lookup the bank would reject downstream.
      console.error(`[wema-account-lookup] req=${requestId} no BVN/NIN available and no fallback configured`);
      return invalidAccountResponse();
    }

    const accountName = va.account_name?.includes("/")
      ? va.account_name
      : formatAccountName(va.account_name ?? "Student");

    const blocked = va.account_status !== "active" || va.is_active === false || va.status !== "active";
    if (blocked) {
      logVas("wema-account-lookup", requestId, "inactive account", { accountNumber });
      return inactiveAccountResponse({ accountname: accountName, bvn, nin });
    }

    logVas("wema-account-lookup", requestId, "resolved", { accountNumber });
    // Static virtual accounts: no `amount` field (that is dynamic-account only).
    return vasJson({
      accountname: accountName,
      status: VAS_STATUS.SUCCESS,
      status_desc: VAS_DESC.SUCCESS,
      bvn,
      nin,
    });
  } catch (e) {
    console.error(`[wema-account-lookup] req=${requestId} error`, e instanceof Error ? e.message : e);
    return invalidAccountResponse();
  }
});
