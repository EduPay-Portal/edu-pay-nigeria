// Shared helpers for edge-function security tests.
// Skips tests gracefully when test credentials aren't configured.
import "https://deno.land/std@0.224.0/dotenv/load.ts";

export const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
export const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export const TEST_ADMIN_EMAIL = Deno.env.get("TEST_ADMIN_EMAIL") ?? "";
export const TEST_ADMIN_PASSWORD = Deno.env.get("TEST_ADMIN_PASSWORD") ?? "";
export const TEST_STUDENT_EMAIL = Deno.env.get("TEST_STUDENT_EMAIL") ?? "";
export const TEST_STUDENT_PASSWORD = Deno.env.get("TEST_STUDENT_PASSWORD") ?? "";

export const haveBase = () => SUPABASE_URL.length > 0 && ANON_KEY.length > 0;
export const haveAdminCreds = () => haveBase() && TEST_ADMIN_EMAIL && TEST_ADMIN_PASSWORD;
export const haveStudentCreds = () => haveBase() && TEST_STUDENT_EMAIL && TEST_STUDENT_PASSWORD;

export async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

export async function callFn(
  name: string,
  opts: { token?: string; body?: unknown; method?: string } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : "{}",
  });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

/** Runs assertion suite for admin-gated endpoints. */
export async function assertAdminGuard(
  fn: string,
  body: unknown = {},
  assertEqualsFn: (a: unknown, b: unknown, msg?: string) => void,
) {
  // 1. No auth header
  const r1 = await callFn(fn, { body });
  assertEqualsFn(r1.status, 401, `${fn}: expected 401 with no auth, got ${r1.status}`);

  // 2. Anon key as bearer (no user)
  const r2 = await callFn(fn, { token: ANON_KEY, body });
  assertEqualsFn(r2.status === 401 || r2.status === 403, true, `${fn}: anon bearer should be 401/403, got ${r2.status}`);

  // 3. Authenticated non-admin
  if (haveStudentCreds()) {
    const token = await signIn(TEST_STUDENT_EMAIL, TEST_STUDENT_PASSWORD);
    const r3 = await callFn(fn, { token, body });
    assertEqualsFn(r3.status, 403, `${fn}: non-admin should be 403, got ${r3.status} body=${JSON.stringify(r3.body)}`);
  }
}
