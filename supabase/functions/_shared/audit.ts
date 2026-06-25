// Shared audit-log writer for edge functions.
// Records sensitive admin actions with request_id and ip for traceability.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface AuditEvent {
  actorId: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** Best-effort audit insert. Never throws — logs to console on failure. */
export async function writeAudit(
  supabase: SupabaseClient,
  event: AuditEvent,
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: event.actorId,
      action: event.action,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      request_id: event.requestId ?? null,
      ip: event.ip ?? null,
      before: event.before ?? null,
      after: event.after ?? null,
      metadata: event.metadata ?? {},
    });
    if (error) console.error("[audit] insert failed:", error.message, event.action);
  } catch (e) {
    console.error("[audit] insert threw:", e, event.action);
  }
}
