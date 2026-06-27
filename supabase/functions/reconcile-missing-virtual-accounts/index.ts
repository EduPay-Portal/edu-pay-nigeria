// Scheduled reconciliation: find students without active virtual accounts
// (and without an active provisioning job) and enqueue + invoke provisioning.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, getRequestId, getRequestIp, requireAdminOrServiceRole } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();
  const guard = await requireAdminOrServiceRole(req, supabase);
  if (guard instanceof Response) return guard;
  const { actorId, actorRole } = guard;
  const requestId = getRequestId(req);
  const ip = getRequestIp(req);
  const provider = "wema";

  // All student user_ids
  const { data: students, error: studentsErr } = await supabase
    .from("student_profiles")
    .select("user_id")
    .limit(1000);
  if (studentsErr) {
    return json({ error: studentsErr.message, request_id: requestId }, 500);
  }
  const studentIds = (students ?? []).map((s) => s.user_id as string);

  if (studentIds.length === 0) {
    return json({ scanned: 0, enqueued: 0, skipped: 0, request_id: requestId });
  }

  // Existing active VAs
  const { data: existingVAs } = await supabase
    .from("virtual_accounts")
    .select("student_id")
    .in("student_id", studentIds)
    .eq("provider", provider)
    .eq("status", "active");
  const withVA = new Set((existingVAs ?? []).map((v) => v.student_id as string));

  // Existing active provisioning jobs (pending/processing/completed)
  const { data: existingJobs } = await supabase
    .from("virtual_account_provisioning_jobs")
    .select("student_id, status")
    .in("student_id", studentIds)
    .eq("provider", provider);
  const jobByStudent = new Map<string, string>();
  (existingJobs ?? []).forEach((j) => jobByStudent.set(j.student_id as string, j.status as string));

  const missing = studentIds.filter((id) => {
    if (withVA.has(id)) return false;
    const st = jobByStudent.get(id);
    if (st === "completed" || st === "processing" || st === "pending") return false;
    return true;
  });

  let enqueued = 0;
  let invokeFailed = 0;
  for (const studentId of missing) {
    const { error: upErr } = await supabase
      .from("virtual_account_provisioning_jobs")
      .upsert({
        student_id: studentId,
        provider,
        status: "pending",
        attempts: 0,
        next_retry_at: null,
        last_error: null,
        metadata: { source: "reconciliation" },
        updated_at: new Date().toISOString(),
      }, { onConflict: "student_id,provider" });
    if (upErr) { invokeFailed++; continue; }

    try {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/provision-student-virtual-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          "x-request-id": requestId,
        },
        body: JSON.stringify({ student_id: studentId, provider }),
      });
      await res.text();
      enqueued++;
    } catch {
      invokeFailed++;
    }
  }

  const summary = {
    scanned: studentIds.length,
    enqueued,
    skipped: studentIds.length - missing.length,
    invoke_failed: invokeFailed,
  };

  await writeAudit(supabase, {
    actorId,
    action: "reconciliation.virtual_accounts",
    entityType: "virtual_account",
    requestId,
    ip,
    metadata: { actor_role: actorRole, provider, ...summary },
  });

  return json({ ...summary, request_id: requestId });
});
