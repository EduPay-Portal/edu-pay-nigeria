// Admin-only edge function for creating user accounts (parents/students).
// Uses shared admin guard + audit writer.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, requireAdmin } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/audit.ts";

interface Body {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: "parent" | "student";
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

  const admin = adminClient();
  const guard = await requireAdmin(req, admin);
  if (guard instanceof Response) return guard;
  const { actorId, requestId, ip } = guard;

  try {
    const body: Body = await req.json();
    if (!body.email || !body.password || !body.first_name || !body.last_name || !body.role) {
      return new Response(JSON.stringify({ error: "Missing required fields", request_id: requestId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.role !== "parent" && body.role !== "student") {
      return new Response(JSON.stringify({ error: "Invalid role", request_id: requestId }), {
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
      return new Response(JSON.stringify({ error: createErr?.message ?? "User creation failed", request_id: requestId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = created.user.id;
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

    await writeAudit(admin, {
      actorId,
      action: `user.create.${body.role}`,
      entityType: "user",
      entityId: newUserId,
      requestId,
      ip,
      after: { email: body.email, role: body.role },
    });

    return new Response(JSON.stringify({ user_id: newUserId, email: body.email, request_id: requestId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin-create-user] error", msg, "request_id=", requestId);
    return new Response(JSON.stringify({ error: "Internal error", request_id: requestId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
