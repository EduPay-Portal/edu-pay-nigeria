// Backend-only student VA provisioning workflow with retry-with-backoff.
// Admin callers and service-role processes can invoke this. It provisions
// through `dva-create` using service-role credentials so students/parents never
// need direct creation privileges.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, requireAdminOrServiceRole } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

interface Body {
  student_id?: string;
  provider?: "wema";
  force?: boolean;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Exponential backoff schedule (ms): 30s, 2m, 8m, 30m, 2h
const BACKOFF_MS = [30_000, 120_000, 480_000, 1_800_000, 7_200_000];

function nextRetryAt(attempt: number): string {
  const idx = Math.min(attempt, BACKOFF_MS.length - 1);
  return new Date(Date.now() + BACKOFF_MS[idx]).toISOString();
}

function isTransientStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

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
  const force = body.force === true;

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

  // Load existing job to compute attempt count
  const { data: existingJob } = await supabase
    .from("virtual_account_provisioning_jobs")
    .select("attempts, max_attempts, status")
    .eq("student_id", studentId)
    .eq("provider", provider)
    .maybeSingle();

  const previousAttempts = force ? 0 : (existingJob?.attempts ?? 0);
  const maxAttempts = existingJob?.max_attempts ?? 5;
  const currentAttempt = previousAttempts + 1;

  await writeAudit(supabase, {
    actorId,
    action: force ? "virtual_account.manual_retry" : "virtual_account.provision.started",
    entityType: "virtual_account",
    requestId,
    ip,
    metadata: { actor_role: actorRole, student_id: studentId, provider, attempt: currentAttempt, force },
  });

  await markJob(supabase, studentId, provider, {
    status: "processing",
    request_id: requestId,
    attempts: currentAttempt,
    last_attempt_at: new Date().toISOString(),
    next_retry_at: null,
    last_error: null,
    metadata: { actor_role: actorRole, source: force ? "manual_retry" : "provision-student-virtual-account" },
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
        next_retry_at: null,
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
      // Terminal failure — no retry.
      await writeAudit(supabase, {
        actorId,
        action: "virtual_account.provision.failed",
        entityType: "virtual_account",
        requestId,
        ip,
        metadata: { actor_role: actorRole, student_id: studentId, provider, reason, terminal: true },
      });
      await markJob(supabase, studentId, provider, {
        status: "failed",
        request_id: requestId,
        last_error: reason,
        next_retry_at: null,
        metadata: { actor_role: actorRole, reason, terminal: true },
      });
      return json({
        error: "Student profile incomplete",
        message: "Student name and email are required before provisioning a virtual account.",
        request_id: requestId,
      }, 422);
    }

    let res: Response;
    let networkError: Error | null = null;
    try {
      res = await fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/dva-create`, {
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
    } catch (e) {
      networkError = e instanceof Error ? e : new Error(String(e));
      res = new Response(networkError.message, { status: 0 });
    }

    const text = networkError ? networkError.message : await res.text();
    let result: unknown = text;
    try { result = JSON.parse(text); } catch { /* keep text */ }

    if (!res.ok) {
      const status = res.status;
      const transient = isTransientStatus(status);
      const canRetry = transient && currentAttempt < maxAttempts;
      const retryAt = canRetry ? nextRetryAt(currentAttempt) : null;

      await writeAudit(supabase, {
        actorId,
        action: canRetry ? "virtual_account.provision.retry_scheduled" : "virtual_account.provision.failed",
        entityType: "virtual_account",
        requestId,
        ip,
        metadata: {
          actor_role: actorRole,
          student_id: studentId,
          provider,
          status,
          attempt: currentAttempt,
          max_attempts: maxAttempts,
          next_retry_at: retryAt,
          reason: text.slice(0, 1000),
          transient,
        },
      });
      await markJob(supabase, studentId, provider, {
        status: canRetry ? "pending" : "failed",
        request_id: requestId,
        last_error: text.slice(0, 1000),
        next_retry_at: retryAt,
        metadata: { actor_role: actorRole, status, transient, attempt: currentAttempt, max_attempts: maxAttempts },
      });
      return json({
        error: canRetry ? "Provisioning will retry" : "Provisioning failed",
        message: canRetry
          ? `Temporary provisioning issue. Retry ${currentAttempt} of ${maxAttempts} scheduled.`
          : "The virtual account could not be provisioned. Please retry from the admin panel or contact support.",
        attempt: currentAttempt,
        max_attempts: maxAttempts,
        next_retry_at: retryAt,
        details: result,
        request_id: requestId,
      }, canRetry ? 202 : status);
    }

    await writeAudit(supabase, {
      actorId,
      action: "virtual_account.provision.completed",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: actorRole, student_id: studentId, provider, attempt: currentAttempt },
      after: typeof result === "object" && result !== null ? result as Record<string, unknown> : { result },
    });

    await markJob(supabase, studentId, provider, {
      status: "completed",
      request_id: requestId,
      last_error: null,
      next_retry_at: null,
      processed_at: new Date().toISOString(),
      metadata: { actor_role: actorRole, attempt: currentAttempt },
    });

    return json({ message: "Virtual account provisioned", result, request_id: requestId });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Unknown error";
    const canRetry = currentAttempt < maxAttempts;
    const retryAt = canRetry ? nextRetryAt(currentAttempt) : null;
    await writeAudit(supabase, {
      actorId,
      action: canRetry ? "virtual_account.provision.retry_scheduled" : "virtual_account.provision.failed",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: actorRole, student_id: studentId, provider, reason, attempt: currentAttempt, next_retry_at: retryAt },
    });
    await markJob(supabase, studentId, provider, {
      status: canRetry ? "pending" : "failed",
      request_id: requestId,
      last_error: reason,
      next_retry_at: retryAt,
      metadata: { actor_role: actorRole, reason, attempt: currentAttempt },
    });
    return json({ error: reason, request_id: requestId, next_retry_at: retryAt }, canRetry ? 202 : 500);
  }
});
