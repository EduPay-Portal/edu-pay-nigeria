// Backend-only student VA provisioning workflow.
// Admin callers and service-role processes can invoke this. It provisions
// through `dva-create` using service-role credentials so students/parents never
// need direct creation privileges.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, requireAdminOrServiceRole } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

interface Body {
  student_id?: string;
  provider?: "wema";
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function markJob(
  supabase: ReturnType<typeof adminClient>,
  studentId: string,
  provider: "wema",
  patch: Record<string, unknown>,
) {
  await supabase
    .from("virtual_account_provisioning_jobs")
    .upsert({
      student_id: studentId,
      provider,
      ...patch,
      updated_at: new Date().toISOString(),
    }, { onConflict: "student_id,provider" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();
  const guard = await requireAdminOrServiceRole(req, supabase);
  if (guard instanceof Response) return guard;
  const { actorId, requestId, ip, actorRole } = guard;

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body", request_id: requestId }, 400);
  }

  const provider = body.provider ?? "wema";
  const studentId = body.student_id;

  if (!studentId) {
    await writeAudit(supabase, {
      actorId,
      action: "virtual_account.provision.failed",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: actorRole, reason: "Missing student_id", provider },
    });
    return json({ error: "Missing student_id", request_id: requestId }, 400);
  }

  await writeAudit(supabase, {
    actorId,
    action: "virtual_account.provision.started",
    entityType: "virtual_account",
    requestId,
    ip,
    metadata: { actor_role: actorRole, student_id: studentId, provider },
  });

  await markJob(supabase, studentId, provider, {
    status: "processing",
    request_id: requestId,
    attempts: 1,
    last_error: null,
    metadata: { actor_role: actorRole, source: "provision-student-virtual-account" },
  });

  try {
    const { data: existing } = await supabase
      .from("virtual_accounts")
      .select("id, account_number, bank_name, provider, status")
      .eq("student_id", studentId)
      .eq("provider", provider)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      await writeAudit(supabase, {
        actorId,
        action: "virtual_account.provision.skipped_existing",
        entityType: "virtual_account",
        entityId: existing.id,
        requestId,
        ip,
        metadata: { actor_role: actorRole, student_id: studentId, provider },
      });
      await markJob(supabase, studentId, provider, {
        status: "completed",
        request_id: requestId,
        last_error: null,
        processed_at: new Date().toISOString(),
        metadata: { actor_role: actorRole, reason: "already_exists", account_id: existing.id },
      });
      return json({ message: "Virtual account already exists", account: existing, request_id: requestId });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", studentId)
      .maybeSingle();

    if (profileError || !profile?.email || !profile?.first_name || !profile?.last_name) {
      const reason = profileError?.message ?? "Missing required student profile data";
      await writeAudit(supabase, {
        actorId,
        action: "virtual_account.provision.failed",
        entityType: "virtual_account",
        requestId,
        ip,
        metadata: { actor_role: actorRole, student_id: studentId, provider, reason },
      });
      await markJob(supabase, studentId, provider, {
        status: "failed",
        request_id: requestId,
        last_error: reason,
        metadata: { actor_role: actorRole, reason },
      });
      return json({
        error: "Student profile incomplete",
        message: "Student name and email are required before provisioning a virtual account.",
        request_id: requestId,
      }, 422);
    }

    const res = await fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/dva-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        student_id: studentId,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        provider,
      }),
    });

    const text = await res.text();
    let result: unknown = text;
    try { result = JSON.parse(text); } catch { /* keep text */ }

    if (!res.ok) {
      await writeAudit(supabase, {
        actorId,
        action: "virtual_account.provision.failed",
        entityType: "virtual_account",
        requestId,
        ip,
        metadata: { actor_role: actorRole, student_id: studentId, provider, status: res.status, reason: text.slice(0, 1000) },
      });
      await markJob(supabase, studentId, provider, {
        status: "failed",
        request_id: requestId,
        last_error: text.slice(0, 1000),
        metadata: { actor_role: actorRole, status: res.status, reason: text.slice(0, 1000) },
      });
      return json({
        error: "Provisioning failed",
        message: "The virtual account could not be provisioned automatically. Please retry from the admin panel or contact support.",
        details: result,
        request_id: requestId,
      }, res.status);
    }

    await writeAudit(supabase, {
      actorId,
      action: "virtual_account.provision.completed",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: actorRole, student_id: studentId, provider },
      after: typeof result === "object" && result !== null ? result as Record<string, unknown> : { result },
    });

    await markJob(supabase, studentId, provider, {
      status: "completed",
      request_id: requestId,
      last_error: null,
      processed_at: new Date().toISOString(),
      metadata: { actor_role: actorRole },
    });

    return json({ message: "Virtual account provisioned", result, request_id: requestId });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Unknown error";
    await writeAudit(supabase, {
      actorId,
      action: "virtual_account.provision.failed",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: actorRole, student_id: studentId, provider, reason },
    });
    await markJob(supabase, studentId, provider, {
      status: "failed",
      request_id: requestId,
      last_error: reason,
      metadata: { actor_role: actorRole, reason },
    });
    return json({ error: reason, request_id: requestId }, 500);
  }
});