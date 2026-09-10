// Wema Bank VAS — shared helpers for the vendor-hosted APIs.
//
// Direction of travel: WEMA BANK CALLS US. This app is the vendor. It generates
// its own NUBANs (prefix + 7-digit serial) and exposes the REST endpoints the
// bank invokes (Account Lookup, Transaction Notification, Fetch Mini Statement,
// Get KYC Details, Block Account).
//
// Authentication is a STATIC BEARER TOKEN that the vendor issues to the bank.
// Spec: https://wemabank-doc.notion.site/VAS-Integration-Endpoints-32013df490b680378760cc6ff6169e63

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const env = (k: string) => Deno.env.get(k) ?? "";

/** Documented Wema VAS status codes. */
export const VAS_STATUS = {
  SUCCESS: "00",
  INVALID: "07",
} as const;

export const VAS_DESC = {
  SUCCESS: "Successful",
  INVALID_ACCOUNT: "Invalid account",
  INACTIVE_ACCOUNT: "Inactive account",
} as const;

/** The bank posts JSON and expects JSON back; CORS is irrelevant server-to-server but harmless. */
export const vasHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-request-id",
};

export function vasJson(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: vasHeaders });
}

/** Test prefix mandated by the documentation. Production prefix is assigned by Wema. */
export const DEFAULT_TEST_PREFIX = "711";

export function accountPrefix(): string {
  const p = env("WEMA_ACCOUNT_PREFIX") || DEFAULT_TEST_PREFIX;
  if (!/^[0-9]{3}$/.test(p)) {
    throw new Error(`WEMA_ACCOUNT_PREFIX must be exactly 3 digits (got "${p}")`);
  }
  return p;
}

export function vendorName(): string {
  return (env("WEMA_VENDOR_NAME") || "ASCI").trim();
}

export function vasEnvironment(): "sandbox" | "production" {
  return env("WEMA_ENV") === "production" ? "production" : "sandbox";
}

/** Vendor name first, then customer name — required by the Account Lookup spec. */
export function formatAccountName(customerName: string): string {
  return `${vendorName()}/${customerName.trim()}`;
}

/** Timing-safe string comparison for the static bearer token. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface BearerCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Validates the static Bearer token Wema presents. Never logs or echoes the
 * token itself.
 */
export function checkVasBearer(req: Request): BearerCheck {
  const expected = env("WEMA_VAS_BEARER_TOKEN");
  if (!expected) return { ok: false, reason: "vas_token_not_configured" };

  const header = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return { ok: false, reason: "missing_bearer" };

  const token = header.slice(7).trim();
  if (!token || !safeEqual(token, expected)) return { ok: false, reason: "invalid_bearer" };

  return { ok: true };
}

/** Standard 401 body for the bank. Deliberately terse — no internal detail. */
export function unauthorizedResponse(): Response {
  return vasJson({ status: "96", status_desc: "Unauthorized" }, 401);
}

export function invalidAccountResponse(extra: Record<string, unknown> = {}): Response {
  return vasJson({ status: VAS_STATUS.INVALID, status_desc: VAS_DESC.INVALID_ACCOUNT, ...extra });
}

export function inactiveAccountResponse(extra: Record<string, unknown> = {}): Response {
  return vasJson({ status: VAS_STATUS.INVALID, status_desc: VAS_DESC.INACTIVE_ACCOUNT, ...extra });
}

/** Reads and JSON-parses the body; returns null when unparseable. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const raw = await req.text();
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** A 10-digit NUBAN is valid only when it carries our configured prefix. */
export function isOurAccountNumber(accountNumber: string): boolean {
  return /^[0-9]{10}$/.test(accountNumber) && accountNumber.startsWith(accountPrefix());
}

/**
 * Allocates the next unused NUBAN: configured prefix + unique 7-digit serial.
 * Uniqueness is enforced by the database (sequence + unique index).
 */
export async function allocateAccountNumber(supabase: SupabaseClient): Promise<string> {
  const prefix = accountPrefix();
  const { data, error } = await supabase.rpc("allocate_virtual_account_number", { p_prefix: prefix });
  if (error) throw new Error(`Account number allocation failed: ${error.message}`);
  const accountNumber = String(data);
  if (!/^[0-9]{10}$/.test(accountNumber) || !accountNumber.startsWith(prefix)) {
    throw new Error("Allocated account number failed prefix/length validation");
  }
  return accountNumber;
}

/** BVN/NIN — at least one must be returned on every lookup (regulatory requirement). */
export function identityFor(bvn?: string | null, nin?: string | null): { bvn: string; nin: string } {
  const resolvedBvn = (bvn || env("WEMA_FALLBACK_BVN") || "").trim();
  const resolvedNin = (nin || env("WEMA_FALLBACK_NIN") || "").trim();
  return { bvn: resolvedBvn, nin: resolvedNin };
}

export function logVas(fn: string, requestId: string, message: string, extra: Record<string, unknown> = {}) {
  // Never include tokens, secrets or full payloads containing identity data.
  console.log(`[${fn}] req=${requestId} ${message}`, JSON.stringify(extra));
}
