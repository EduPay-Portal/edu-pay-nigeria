// Bulk re-issue Wema DVAs for students whose existing virtual account is archived or missing.
// Sequential, 2s delay, exponential backoff per project memory.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles?.some((r: any) => r.role === "admin")) {
    return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers: corsHeaders });
  }

  const { limit = 50 } = (await req.json().catch(() => ({}))) as { limit?: number };

  // Students lacking an active wema DVA
  const { data: students, error } = await supabase
    .from("student_profiles")
    .select("user_id")
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  const results: Array<{ student_id: string; status: string; error?: string }> = [];

  for (const s of students ?? []) {
    const { data: existing } = await supabase
      .from("virtual_accounts")
      .select("id")
      .eq("student_id", s.user_id)
      .eq("provider", "wema")
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      results.push({ student_id: s.user_id, status: "skipped" });
      continue;
    }

    const { data: profile } = await supabase
      .from("profiles").select("first_name, last_name, email").eq("id", s.user_id).maybeSingle();
    if (!profile?.email) {
      results.push({ student_id: s.user_id, status: "error", error: "missing profile/email" });
      continue;
    }

    let attempt = 0;
    let ok = false;
    let lastErr = "";
    while (attempt < 3 && !ok) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/dva-create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({
            student_id: s.user_id,
            first_name: profile.first_name ?? "",
            last_name: profile.last_name ?? "",
            email: profile.email,
            provider: "wema",
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        ok = true;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        attempt++;
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
    results.push({ student_id: s.user_id, status: ok ? "created" : "error", error: ok ? undefined : lastErr });
    await sleep(2000);
  }

  return new Response(JSON.stringify({ summary: { total: results.length, results } }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
