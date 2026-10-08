// TEMPORARY self-test — delete after use.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient } from "../_shared/auth.ts";

serve(async () => {
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
  const token = Deno.env.get("WEMA_VAS_BEARER_TOKEN") ?? "";
  const acct = "7110234995";
  const call = async (fn: string, body: unknown) => {
    const r = await fetch(`${base}/${fn}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { fn, http: r.status, body: await r.json() };
  };
  const out = [];
  out.push(await call("wema-account-lookup", { accountnumber: acct }));
  out.push(await call("wema-kyc-details", { accountnumber: acct }));
  out.push(await call("wema-mini-statement", { accountnumber: acct }));
  out.push(await call("wema-block-account", { accountnumber: acct, reason: "selftest" }));
  out.push(await call("wema-account-lookup", { accountnumber: acct }));
  out.push(await call("wema-kyc-details", { accountnumber: acct }));
  const sb = adminClient();
  await sb.from("virtual_accounts").update({
    account_status: "active", is_active: true, status: "active", blocked_at: null, block_reason: null,
  }).eq("account_number", acct);
  out.push(await call("wema-account-lookup", { accountnumber: acct }));
  // mask identity
  const masked = JSON.stringify(out).replace(/"(bvn|nin|mobilenumber)":"(\d{0,3})\d*"/g, '"$1":"$2***"');
  return new Response(masked, { headers: { "Content-Type": "application/json" } });
});
