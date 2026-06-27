// Scheduled worker: picks up pending provisioning jobs that are due for retry
// and invokes provision-student-virtual-account for each (service-role).
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

  const nowIso = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from("virtual_account_provisioning_jobs")
    .select("student_id, provider, attempts, max_attempts, next_retry_at")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(50);

  if (error) {
    return json({ error: error.message, request_id: requestId }, 500);
  }

  const dueJobs = (jobs ?? []).filter((j) => (j.attempts ?? 0) < (j.max_attempts ?? 5));

  let invoked = 0;
  let failed = 0;
  for (const job of dueJobs) {
    try {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/provision-student-virtual-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          "x-request-id": requestId,
        },
        body: JSON.stringify({ student_id: job.student_id, provider: job.provider }),
      });
      await res.text();
      invoked++;
    } catch {
      failed++;
    }
  }

  await writeAudit(supabase, {
    actorId,
    action: "virtual_account.provision.worker_run",
    entityType: "virtual_account",
    requestId,
    ip,
    metadata: { actor_role: actorRole, scanned: jobs?.length ?? 0, invoked, failed, due: dueJobs.length },
  });

  return json({ scanned: jobs?.length ?? 0, due: dueJobs.length, invoked, failed, request_id: requestId });
});
