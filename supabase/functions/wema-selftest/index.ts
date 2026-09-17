// TEMPORARY self-test harness for the Wema VAS endpoints. Deleted after use.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const TOKEN = Deno.env.get("WEMA_VAS_BEARER_TOKEN") ?? "";

async function call(path: string, body: unknown, token = TOKEN) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let json: unknown;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = text; }
  return { path, http: res.status, body: json };
}

serve(async (req) => {
  const p = new URL(req.url).searchParams;
  const lookupAcct = p.get("lookup") ?? "7110234980";
  const creditAcct = p.get("credit") ?? "7110234981";
  const blockAcct = p.get("block") ?? "7110234995";
  const session = `SELFTEST${Date.now()}`.padEnd(30, "0");

  const results: unknown[] = [];
  results.push(await call("/wema-account-lookup", { accountnumber: lookupAcct }));
  results.push(await call("/wema-account-lookup", { accountnumber: "7119999999" }));
  results.push(await call("/wema-transaction-notification", {
    sessionid: session,
    craccount: creditAcct,
    amount: "100.00",
    paymentreference: `NIP/REF/${session}`,
    originatorname: "WEMA SELF TEST",
    originatoraccountnumber: "0123456789",
    bankname: "Wema Bank",
  }));
  results.push(await call("/wema-transaction-notification", {
    sessionid: session,
    craccount: creditAcct,
    amount: "100.00",
    paymentreference: `NIP/REF/${session}`,
    originatorname: "WEMA SELF TEST",
  }));
  results.push(await call("/wema-mini-statement", { accountnumber: creditAcct }));
  results.push(await call("/wema-kyc-details", { accountnumber: lookupAcct }));
  results.push(await call("/wema-block-account", { accountnumber: blockAcct, reason: "Self-test" }));
  results.push(await call("/wema-account-lookup", { accountnumber: blockAcct }));
  results.push(await call("/wema-account-lookup", { accountnumber: lookupAcct }, "wrong-token"));

  return new Response(JSON.stringify({ session, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
