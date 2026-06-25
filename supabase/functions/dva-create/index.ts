// Provider-agnostic DVA creation. Defaults to Wema Bank.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getDVAProvider, DEFAULT_DVA_PROVIDER } from "../_shared/payments/registry.ts";
import type { ProviderName } from "../_shared/payments/types.ts";
import { adminClient, corsHeaders, requireAdminOrServiceRole } from "../_shared/auth.ts";
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
  const guard = await requireAdminOrServiceRole(req, supabase);
  if (guard instanceof Response) return guard;
  const { actorId, requestId, ip } = guard;

  try {
    const body: Body = await req.json();
    const providerName: ProviderName = body.provider ?? DEFAULT_DVA_PROVIDER;
    console.log(`[dva-create] req=${requestId} provider=${providerName} student=${body.student_id}`);

    const { data: existing } = await supabase
      .from("virtual_accounts")
      .select("id, account_number, bank_name, provider, status")
      .eq("student_id", body.student_id)
      .eq("provider", providerName)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
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
    return new Response(JSON.stringify({ error: msg, request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
