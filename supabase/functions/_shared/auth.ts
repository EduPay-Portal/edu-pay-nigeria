// Shared admin authorization guard for edge functions.
// Returns either { user, actorId, requestId } on success, or a Response (401/403) to return directly.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function getRequestIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export interface AdminContext {
  user: { id: string; email?: string | null } | null;
  actorId: string | null;
  requestId: string;
  ip: string | null;
  isServiceRole: boolean;
}

/**
 * Require an authenticated admin caller. Strictly denies missing/null roles.
 * Returns a Response on failure (caller should return it directly).
 */
export async function requireAdmin(
  req: Request,
  supabase: SupabaseClient,
): Promise<AdminContext | Response> {
  const requestId = getRequestId(req);
  const ip = getRequestIp(req);
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Missing authorization", request_id: requestId }, 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return json({ error: "Missing authorization", request_id: requestId }, 401);
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return json({ error: "Unauthorized", request_id: requestId }, 401);
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  // Explicit null/false denial — never trust missing roles.
  if (roleError || isAdmin !== true) {
    return json({ error: "Admin role required", request_id: requestId }, 403);
  }

  return {
    user: { id: user.id, email: user.email },
    actorId: user.id,
    requestId,
    ip,
    isServiceRole: false,
  };
}

/**
 * Same as requireAdmin but allows server-to-server calls that present the
 * service-role key (used by DB triggers and other edge functions).
 */
export async function requireAdminOrServiceRole(
  req: Request,
  supabase: SupabaseClient,
): Promise<AdminContext | Response> {
  const requestId = getRequestId(req);
  const ip = getRequestIp(req);
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Missing authorization", request_id: requestId }, 401);
  }
  const token = authHeader.slice(7).trim();

  if (token === serviceRoleKey) {
    return { user: null, actorId: null, requestId, ip, isServiceRole: true };
  }

  return requireAdmin(req, supabase);
}
