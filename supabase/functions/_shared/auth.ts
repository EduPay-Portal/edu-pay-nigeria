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
  actorRole?: AppRole | "service_role" | null;
}

export type AppRole = "admin" | "student" | "parent";

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[auth] role lookup failed", error.message, { userId });
    return null;
  }

  return (data?.role as AppRole | undefined) ?? null;
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

  // has_role lives in the `private` schema (not exposed via PostgREST), so
  // query user_roles directly with the service-role client which bypasses RLS.
  const role = await getUserRole(supabase, user.id);
  // Explicit null denial — never trust missing roles.
  if (role !== "admin") {
    return json({
      error: "Admin role required",
      message: "Only school administrators can perform this action.",
      actor_role: role ?? "none",
      request_id: requestId,
    }, 403);
  }

  return {
    user: { id: user.id, email: user.email },
    actorId: user.id,
    requestId,
    ip,
    isServiceRole: false,
    actorRole: role,
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
    return { user: null, actorId: null, requestId, ip, isServiceRole: true, actorRole: "service_role" };
  }

  return requireAdmin(req, supabase);
}
