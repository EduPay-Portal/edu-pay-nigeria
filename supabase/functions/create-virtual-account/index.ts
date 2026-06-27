// Admin-only compatibility endpoint. The canonical provider-agnostic creation
// path is `dva-create`; this endpoint keeps existing admin UI callers working
// while returning friendly, role-aware errors for non-admin users.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, getRequestId, getRequestIp, getUserRole } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const supabase = adminClient();
  const requestId = getRequestId(req);
  const ip = getRequestIp(req);
  const authHeader = req.headers.get("Authorization");

  let rawBody = "{}";
  let parsedBody: Record<string, unknown> = {};
  try {
    rawBody = await req.text();
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return json({ error: "Invalid JSON body", request_id: requestId }, 400);
  }

  const studentId = typeof parsedBody.student_id === "string" ? parsedBody.student_id : null;

  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    await writeAudit(supabase, {
      actorId: null,
      action: "virtual_account.create.denied",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: "anonymous", student_id: studentId, reason: "Missing authorization" },
    });
    return json({
      error: "Missing authorization",
      message: "Please sign in as an administrator to create a virtual account.",
      actor_role: "anonymous",
      request_id: requestId,
    }, 401);
  }

  const token = authHeader.slice(7).trim();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    await writeAudit(supabase, {
      actorId: null,
      action: "virtual_account.create.denied",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: "invalid_token", student_id: studentId, reason: "Unauthorized" },
    });
    return json({
      error: "Unauthorized",
      message: "Please sign in again before creating a virtual account.",
      actor_role: "invalid_token",
      request_id: requestId,
    }, 401);
  }

  const actorRole = await getUserRole(supabase, user.id);

  if (actorRole !== "admin") {
    await writeAudit(supabase, {
      actorId: user.id,
      action: "virtual_account.create.denied",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: {
        actor_role: actorRole ?? "none",
        student_id: studentId,
        reason: "Admin role required",
      },
    });

    return json({
      error: "Admin role required",
      message: "Your virtual account is created automatically by the school. If it is still missing after a few minutes, please contact the bursary or school administrator.",
      actor_role: actorRole ?? "none",
      request_id: requestId,
    }, 403);
  }

  await writeAudit(supabase, {
    actorId: user.id,
    action: "virtual_account.create.requested",
    entityType: "virtual_account",
    requestId,
    ip,
    metadata: { actor_role: actorRole, student_id: studentId, source: "create-virtual-account" },
  });

  const res = await fetch(`${SUPABASE_URL}/functions/v1/dva-create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      "x-request-id": requestId,
    },
    body: rawBody,
  });

  const text = await res.text();

  if (!res.ok) {
    await writeAudit(supabase, {
      actorId: user.id,
      action: "virtual_account.create.failed",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: {
        actor_role: actorRole,
        student_id: studentId,
        status: res.status,
        reason: text.slice(0, 1000),
        source: "create-virtual-account",
      },
    });
  }

  return new Response(text, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
