import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RosterAuditAction, RosterAuditEntityType } from "./types";

type LogAuditInput = {
  entity_type: RosterAuditEntityType;
  entity_id: string;
  action: RosterAuditAction;
  before?: unknown;
  after?: unknown;
};

export async function logAudit(input: LogAuditInput): Promise<void> {
  await logAuditBatch([input]);
}

/**
 * Batched version of logAudit — one insert call for many events. Resolves
 * the user once instead of per-event.
 */
export async function logAuditBatch(inputs: LogAuditInput[]): Promise<void> {
  if (inputs.length === 0) return;

  const userScoped = await createClient();
  const {
    data: { user },
  } = await userScoped.auth.getUser();

  const rows = inputs.map((i) => ({
    user_id: user?.id ?? null,
    entity_type: i.entity_type,
    entity_id: i.entity_id,
    action: i.action,
    before_data: i.before ?? null,
    after_data: i.after ?? null,
  }));

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from("roster_audit_events") as any).insert(rows);

  if (error) {
    console.error("[logAudit] failed to write audit events:", error.message);
  }
}
