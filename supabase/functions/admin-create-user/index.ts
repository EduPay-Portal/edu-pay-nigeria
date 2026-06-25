// Admin-only edge function for creating user accounts (parents/students).
// Validates the caller has the 'admin' role before using service-role to create users.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: "parent" | "student";
  // Optional profile fields
  parent_profile?: {
    occupation?: string | null;
    emergency_contact?: string | null;
    notification_preference?: "email" | "sms" | "both";
  };
  student_profile?: {
    admission_number: string;
    class_level: string;
    section?: string | null;
    school_fees?: number | null;
    parent_id?: string | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user } } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role server-side
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    if (!body.email || !body.password || !body.first_name || !body.last_name || !body.role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.role !== "parent" && body.role !== "student") {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        first_name: body.first_name,
        last_name: body.last_name,
        role: body.role,
      },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "User creation failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = created.user.id;

    // Wait briefly for trigger-created profile rows, then update with provided data
    await new Promise((r) => setTimeout(r, 200));

    if (body.role === "parent" && body.parent_profile) {
      await admin.from("parent_profiles")
        .update({
          occupation: body.parent_profile.occupation ?? null,
          emergency_contact: body.parent_profile.emergency_contact ?? null,
          notification_preference: body.parent_profile.notification_preference ?? "email",
        })
        .eq("user_id", newUserId);
    }

    if (body.role === "student" && body.student_profile) {
      await admin.from("student_profiles")
        .update({
          admission_number: body.student_profile.admission_number,
          class_level: body.student_profile.class_level,
          section: body.student_profile.section ?? null,
          school_fees: body.student_profile.school_fees ?? null,
          parent_id: body.student_profile.parent_id ?? null,
        })
        .eq("user_id", newUserId);
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: `admin.create_${body.role}`,
      entity_type: "user",
      entity_id: newUserId,
      after: { email: body.email, role: body.role },
    });

    // NOTE: Do NOT return the password in the response.
    return new Response(JSON.stringify({ user_id: newUserId, email: body.email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin-create-user] error", msg);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
