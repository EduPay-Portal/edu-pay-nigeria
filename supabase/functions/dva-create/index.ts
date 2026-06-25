// Provider-agnostic DVA creation. Defaults to Wema Bank.
// Backward-compatible: same path/contract as the old create-virtual-account function.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getDVAProvider, DEFAULT_DVA_PROVIDER } from "../_shared/payments/registry.ts";
import type { ProviderName } from "../_shared/payments/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin-only: any DVA creation must be initiated by an admin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    const providerName: ProviderName = body.provider ?? DEFAULT_DVA_PROVIDER;
    console.log(`[dva-create] provider=${providerName} student=${body.student_id}`);

    // Skip if active DVA already exists for this provider
    const { data: existing } = await supabase
      .from("virtual_accounts")
      .select("id, account_number, bank_name, provider, status")
      .eq("student_id", body.student_id)
      .eq("provider", providerName)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ message: "Virtual account already exists", account: existing }),
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

    // audit
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "dva.create",
      entity_type: "virtual_account",
      entity_id: saved.id,
      after: saved,
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
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[dva-create] error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
