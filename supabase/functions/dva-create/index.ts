// Provider-agnostic DVA creation. Defaults to Wema Bank.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getDVAProvider, DEFAULT_DVA_PROVIDER } from "../_shared/payments/registry.ts";
import type { ProviderName } from "../_shared/payments/types.ts";
import { adminClient, corsHeaders, getRequestId, getRequestIp, getUserRole } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

interface Body {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bvn?: string;
  provider?: ProviderName;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();
  const requestId = getRequestId(req);
  const ip = getRequestIp(req);
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let actorId: string | null = null;
  let actorRole: "admin" | "student" | "parent" | "service_role" | "anonymous" | "invalid_token" | "none" = "anonymous";

  const deny = async (status: number, error: string, message: string) => {
    await writeAudit(supabase, {
      actorId,
      action: "virtual_account.create.denied",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: actorRole, reason: error, source: "dva-create" },
    });
    return new Response(JSON.stringify({ error, message, actor_role: actorRole, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return await deny(401, "Missing authorization", "Please sign in before requesting virtual account creation.");
  }

  const token = authHeader.slice(7).trim();
  if (token === serviceRoleKey) {
    actorRole = "service_role";
  } else {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      actorRole = "invalid_token";
      return await deny(401, "Unauthorized", "Please sign in again before requesting virtual account creation.");
    }
    actorId = user.id;
    actorRole = (await getUserRole(supabase, user.id)) ?? "none";
    if (actorRole !== "admin") {
      return await deny(403, "Admin role required", "Virtual accounts are provisioned automatically by the school. Please contact the bursary or administrator if yours is still missing.");
    }
  }

  try {
    const body: Body = await req.json();
    const providerName: ProviderName = body.provider ?? DEFAULT_DVA_PROVIDER;
    console.log(`[dva-create] req=${requestId} provider=${providerName} student=${body.student_id}`);

    if (!body.student_id || !body.email || !body.first_name || !body.last_name) {
      await writeAudit(supabase, {
        actorId,
        action: "virtual_account.create.failed",
        entityType: "virtual_account",
        requestId,
        ip,
        metadata: {
          actor_role: actorRole,
          student_id: body.student_id ?? null,
          provider: providerName,
          reason: "Missing required student profile fields",
          source: "dva-create",
        },
      });
      return new Response(JSON.stringify({
        error: "Missing required fields",
        message: "Student name and email are required before a virtual account can be created.",
        request_id: requestId,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await writeAudit(supabase, {
      actorId,
      action: "virtual_account.create.started",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: actorRole, provider: providerName, student_id: body.student_id, source: "dva-create" },
    });

    const { data: existing } = await supabase
      .from("virtual_accounts")
      .select("id, account_number, bank_name, provider, status")
      .eq("student_id", body.student_id)
      .eq("provider", providerName)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      await writeAudit(supabase, {
        actorId,
        action: "virtual_account.create.skipped_existing",
        entityType: "virtual_account",
        entityId: existing.id,
        requestId,
        ip,
        metadata: { actor_role: actorRole, provider: providerName, student_id: body.student_id },
      });
      return new Response(
        JSON.stringify({ message: "Virtual account already exists", account: existing, request_id: requestId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const provider = getDVAProvider(providerName);
    const dva = await provider.createDVA({
      student_id: body.student_id,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      bvn: body.bvn,
    });

    const { data: saved, error } = await supabase
      .from("virtual_accounts")
      .insert({
        student_id: body.student_id,
        provider: dva.provider,
        provider_account_id: dva.provider_account_id,
        provider_customer_id: dva.provider_customer_id,
        account_number: dva.account_number,
        account_name: dva.account_name,
        bank_name: dva.bank_name,
        bank_code: dva.bank_code,
        environment: dva.environment,
        status: "active",
        is_active: true,
        metadata: dva.metadata ?? {},
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`DB insert failed: ${error.message}`);

    await writeAudit(supabase, {
      actorId,
      action: "virtual_account.create",
      entityType: "virtual_account",
      entityId: saved.id,
      requestId,
      ip,
      after: saved,
      metadata: { provider: dva.provider, student_id: body.student_id },
    });

    return new Response(
      JSON.stringify({
        message: "Virtual account created",
        provider: dva.provider,
        account: {
          account_number: dva.account_number,
          account_name: dva.account_name,
          bank_name: dva.bank_name,
        },
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[dva-create] error", e, "request_id=", requestId);
    const msg = e instanceof Error ? e.message : "Unknown error";
    await writeAudit(supabase, {
      actorId,
      action: "virtual_account.create.failed",
      entityType: "virtual_account",
      requestId,
      ip,
      metadata: { actor_role: actorRole, reason: msg, source: "dva-create" },
    });
    return new Response(JSON.stringify({ error: msg, request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
