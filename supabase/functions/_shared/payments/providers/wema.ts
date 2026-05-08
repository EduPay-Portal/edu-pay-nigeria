// Wema Bank DVA provider — STUB IMPLEMENTATION.
// Live API calls are wired but gated behind WEMA_BASE_URL / WEMA_API_KEY env vars.
// Until credentials arrive, createDVA generates a deterministic placeholder NUBAN
// so the rest of the system (UI, reconciliation, simulation) can be exercised end-to-end.
//
// Once Wema sandbox creds are added (WEMA_BASE_URL, WEMA_API_KEY, WEMA_CLIENT_ID,
// WEMA_CLIENT_SECRET, WEMA_WEBHOOK_SECRET), set WEMA_LIVE=true and the live paths
// will engage automatically.

import type {
  CreateDVAInput,
  DVAProvider,
  DVAccount,
  Environment,
  NormalizedTransaction,
  WebhookParseResult,
} from "../types.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

function getEnvironment(): Environment {
  return (env("WEMA_ENV") || "sandbox") as Environment;
}

function isLive(): boolean {
  return env("WEMA_LIVE") === "true" && !!env("WEMA_BASE_URL") && !!env("WEMA_API_KEY");
}

async function hmacSha512(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generatePlaceholderNuban(seed: string): string {
  // Deterministic 10-digit number from a UUID/email seed. Not a real NUBAN.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const base = (9000000000 + (h % 999999999)).toString().slice(0, 10);
  return base.padStart(10, "0");
}

export const wemaProvider: DVAProvider = {
  name: "wema",
  get environment() {
    return getEnvironment();
  },

  async createDVA(input: CreateDVAInput): Promise<DVAccount> {
    const environment = getEnvironment();

    if (isLive()) {
      // Live Wema Virtual NUBAN call (endpoint shape varies by Wema product;
      // adjust path/headers to match the contract you receive from Wema.)
      const res = await fetch(`${env("WEMA_BASE_URL")}/virtual-account/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env("WEMA_API_KEY"),
          "client-id": env("WEMA_CLIENT_ID"),
          "client-secret": env("WEMA_CLIENT_SECRET"),
        },
        body: JSON.stringify({
          customerReference: input.student_id,
          firstName: input.first_name,
          lastName: input.last_name,
          email: input.email,
          phoneNumber: input.phone ?? "",
          bvn: input.bvn ?? "",
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Wema createDVA failed [${res.status}]: ${txt}`);
      }
      const data = await res.json();
      return {
        provider: "wema",
        account_number: data.accountNumber ?? data.account_number,
        account_name: data.accountName ?? `${input.first_name} ${input.last_name}`.trim(),
        bank_name: "WEMA BANK",
        bank_code: "035",
        provider_account_id: data.id ?? data.accountId,
        provider_customer_id: data.customerId ?? input.student_id,
        environment,
        metadata: data,
      };
    }

    // STUB: deterministic placeholder so flows are testable without creds.
    const accountNumber = generatePlaceholderNuban(input.student_id);
    return {
      provider: "wema",
      account_number: accountNumber,
      account_name: `${input.first_name} ${input.last_name}`.trim(),
      bank_name: "WEMA BANK",
      bank_code: "035",
      provider_account_id: `stub-${input.student_id}`,
      provider_customer_id: `stub-cust-${input.student_id}`,
      environment,
      metadata: { stub: true, note: "Generated before live Wema credentials configured" },
    };
  },

  async verifyTransaction(reference: string): Promise<NormalizedTransaction | null> {
    if (!isLive()) return null;
    const res = await fetch(
      `${env("WEMA_BASE_URL")}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          "x-api-key": env("WEMA_API_KEY"),
        },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      provider: "wema",
      provider_reference: data.reference ?? reference,
      amount: Number(data.amount ?? 0),
      currency: data.currency ?? "NGN",
      status: data.status === "successful" ? "completed" : "pending",
      paid_at: data.paidAt,
      account_number: data.accountNumber,
      payer_account_name: data.payerName,
      payer_account_number: data.payerAccountNumber,
      payer_bank: data.payerBank,
      raw: data,
    };
  },

  async parseWebhook(rawBody, headers, _ip): Promise<WebhookParseResult> {
    const secret = env("WEMA_WEBHOOK_SECRET");
    if (!secret) {
      return { valid: false, reason: "WEMA_WEBHOOK_SECRET not configured" };
    }

    const sigHeader =
      headers["x-wema-signature"] ?? headers["x-signature"] ?? headers["wema-signature"] ?? "";
    if (!sigHeader) return { valid: false, reason: "Missing signature header" };

    const expected = await hmacSha512(secret, rawBody);
    if (expected !== sigHeader.toLowerCase()) {
      return { valid: false, reason: "Invalid HMAC signature" };
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "Invalid JSON" };
    }

    const data = body.data ?? body;
    const tx: NormalizedTransaction = {
      provider: "wema",
      provider_reference: data.reference ?? data.transactionReference ?? "",
      amount: Number(data.amount ?? 0),
      currency: data.currency ?? "NGN",
      status: (data.status === "successful" || data.status === "success") ? "completed" : "pending",
      paid_at: data.paidAt ?? data.transactionDate,
      account_number: data.accountNumber ?? data.creditAccount,
      payer_account_name: data.payerName ?? data.originatorName,
      payer_account_number: data.payerAccountNumber ?? data.originatorAccountNumber,
      payer_bank: data.payerBank ?? data.originatorBank,
      raw: body,
    };

    return {
      valid: true,
      event_type: body.event ?? "transaction.success",
      transaction: tx,
    };
  },
};
