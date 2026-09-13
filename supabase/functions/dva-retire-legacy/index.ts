// Retires legacy virtual accounts (numbers not using the agreed Wema prefix)
// and issues fresh prefix-compliant NUBANs for the affected students.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, requireAdmin } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";
import { accountPrefix } from "../_shared/payments/wema-vas.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ResultRow {
  student_id: string;
  old_account_number?: string;
  new_account_number?: string;
  status: "reissued" | "retired_only" | "skipped" | "error";
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const supabase = adminClient();
  const guard = await requireAdmin(req, supabase);
  if (guard instanceof Response) return guard;
  const { actorId, requestId, ip } = guard;

  const authHeader = req.headers.get("Authorization") ?? "";
  const { limit = 50, dry_run = false } = (await req.json().catch(() => ({}))) as {
    limit?: number;
    dry_run?: boolean;
  };

  let prefix: string;
  try {
    prefix = accountPrefix();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Invalid prefix", request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  await writeAudit(supabase, {
    actorId,
    action: "virtual_account.retire_legacy.invoked",
    entityType: "virtual_account",
    requestId,
    ip,
    metadata: { limit, dry_run, prefix },
  });

  // Legacy = active account whose number does not start with the agreed prefix.
  const { data: legacy, error } = await supabase
    .from("virtual_accounts")
    .select("id, student_id, account_number, status")
    .eq("status", "active")
    .not("account_number", "like", `${prefix}%`)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    return new Response(JSON.stringify({ error: error.message, request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (dry_run) {
    return new Response(
      JSON.stringify({
        dry_run: true,
        prefix,
        would_process: legacy?.length ?? 0,
        accounts: (legacy ?? []).map((a) => a.account_number),
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const results: ResultRow[] = [];

  for (const row of legacy ?? []) {
    // Idempotency: if a compliant account already exists, just retire the old one.
    const { data: compliant } = await supabase
      .from("virtual_accounts")
      .select("id, account_number")
      .eq("student_id", row.student_id)
      .eq("status", "active")
      .like("account_number", `${prefix}%`)
      .maybeSingle();

    const retire = async () => {
      const { error: upErr } = await supabase
        .from("virtual_accounts")
        .update({
          status: "retired",
          account_status: "inactive",
          is_active: false,
          block_reason: "Legacy account number retired during Wema prefix migration",
          blocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upErr) throw new Error(`Retire failed: ${upErr.message}`);
      await writeAudit(supabase, {
        actorId,
        action: "virtual_account.retired",
        entityType: "virtual_account",
        entityId: row.id,
        requestId,
        ip,
        metadata: { student_id: row.student_id, old_account_number: row.account_number, prefix },
      });
    };

    try {
      if (compliant) {
        await retire();
        results.push({
          student_id: row.student_id,
          old_account_number: row.account_number,
          new_account_number: compliant.account_number,
          status: "skipped",
        });
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", row.student_id)
        .maybeSingle();

      if (!profile?.email) {
        results.push({
          student_id: row.student_id,
          old_account_number: row.account_number,
          status: "error",
          error: "missing profile/email",
        });
        continue;
      }

      // Retire first so dva-create's "already active" guard does not skip.
      await retire();

      const res = await fetch(`${SUPABASE_URL}/functions/v1/dva-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          "x-request-id": requestId,
        },
        body: JSON.stringify({
          student_id: row.student_id,
          first_name: profile.first_name ?? "",
          last_name: profile.last_name ?? "",
          email: profile.email,
          provider: "wema",
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`dva-create HTTP ${res.status}: ${payload?.error ?? "unknown"}`);

      results.push({
        student_id: row.student_id,
        old_account_number: row.account_number,
        new_account_number: payload?.account?.account_number,
        status: payload?.account?.account_number ? "reissued" : "retired_only",
      });
    } catch (e) {
      results.push({
        student_id: row.student_id,
        old_account_number: row.account_number,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }

    await sleep(300);
  }

  const summary = {
    prefix,
    processed: results.length,
    reissued: results.filter((r) => r.status === "reissued").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  await writeAudit(supabase, {
    actorId,
    action: "virtual_account.retire_legacy.completed",
    entityType: "virtual_account",
    requestId,
    ip,
    metadata: summary,
  });

  return new Response(JSON.stringify({ summary, results, request_id: requestId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
