// TEMPORARY self-test harness for the Wema VAS endpoints.
// Reads WEMA_VAS_BEARER_TOKEN from env (never returned), calls each
// vendor-hosted endpoint, and reports pass/fail. Deleted after verification.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

async function call(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-json */
  }
  return { http: res.status, json };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("WEMA_VAS_BEARER_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "WEMA_VAS_BEARER_TOKEN not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Record<string, unknown> = {};
  const stamp = Date.now();
  const sessionid = `SELFTEST${stamp}`.padEnd(30, "0").slice(0, 30);

  // 1. Account Lookup (known-good account)
  results.lookup = await call("wema-account-lookup", token, { accountnumber: "7110234567" });

  // 2. Transaction Notification (credit demo student account)
  const txnBody = {
    sessionid,
    craccount: "7110234569",
    amount: "100.00",
    paymentreference: `SELFTEST/${stamp}`,
    originatorname: "SELF TEST",
    originatoraccountnumber: "0000000001",
    bankname: "SelfTest Bank",
  };
  results.notify_first = await call("wema-transaction-notification", token, txnBody);
  // 2b. Idempotency: same sessionid again
  results.notify_duplicate = await call("wema-transaction-notification", token, txnBody);

  // 3. Mini Statement (should include the test credit)
  results.mini_statement = await call("wema-mini-statement", token, { accountnumber: "7110234569" });

  // 4. KYC Details
  results.kyc = await call("wema-kyc-details", token, { accountnumber: "7110234567" });

  // 5. Block Account (designated test account) then re-lookup
  results.block = await call("wema-block-account", token, {
    accountnumber: "7110234576",
    reason: "Self-test block (verification)",
  });
  results.lookup_blocked = await call("wema-account-lookup", token, { accountnumber: "7110234576" });

  // 6. Wrong token must be rejected
  results.wrong_token = await call("wema-account-lookup", "wrong-token-value", {
    accountnumber: "7110234567",
  });

  return new Response(JSON.stringify({ sessionid, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
