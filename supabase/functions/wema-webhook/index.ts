// DEPRECATED — kept only so any previously configured URL keeps working.
//
// The Wema VAS specification defines a vendor-hosted "Transaction Notification
// API", not a signed webhook. Configure Wema to call `wema-transaction-notification`
// instead. This shim forwards the request there unchanged.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-request-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const target = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wema-transaction-notification`;
  console.warn("[wema-webhook] deprecated endpoint hit — forwarding to wema-transaction-notification");

  const body = await req.text();
  const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
  const auth = req.headers.get("Authorization");
  if (auth) forwardHeaders["Authorization"] = auth;
  const reqId = req.headers.get("x-request-id");
  if (reqId) forwardHeaders["x-request-id"] = reqId;

  const res = await fetch(target, { method: "POST", headers: forwardHeaders, body });
  const text = await res.text();
  return new Response(text, { status: res.status, headers });
});
