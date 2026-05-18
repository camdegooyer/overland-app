import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ShiftDigest } from "./shift-emails";

/**
 * Send one shift-digest email via the send_email Edge Function and write an
 * audit row to notification_log. Returns success/failure summary; never
 * throws — caller decides whether to surface failures.
 */
export async function sendShiftDigest(
  digest: ShiftDigest,
  recipientEmployeeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let ok = false;
  let errorMessage: string | undefined;
  let gmailMessageId: string | undefined;

  try {
    const { data, error } = await supabase.functions.invoke("send_email", {
      body: {
        to: digest.to,
        subject: digest.subject,
        html: digest.html,
        text: digest.text,
        fromName: "Overland Builders",
        replyTo: process.env.GMAIL_USER_EMAIL ?? undefined,
      },
    });
    if (error) {
      errorMessage = error.message;
    } else if (data && typeof data === "object") {
      const d = data as { ok?: boolean; error?: string; gmail_message_id?: string };
      if (d.ok) {
        ok = true;
        gmailMessageId = d.gmail_message_id;
      } else {
        errorMessage = d.error ?? "Unknown send_email error";
      }
    } else {
      errorMessage = "send_email returned no data";
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  // Audit log — best effort, never throws.
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("notification_log") as any).insert({
      channel: "email",
      recipient_employee_id: recipientEmployeeId,
      recipient_address: digest.to,
      subject: digest.subject,
      kind: digest.kind,
      related_card_ids: digest.cardIds,
      related_assignment_ids: digest.assignmentIds,
      status: ok ? "sent" : "failed",
      error: ok ? null : errorMessage,
      gmail_message_id: gmailMessageId ?? null,
      triggered_by: user?.id ?? null,
    });
  } catch (e) {
    console.error("[sendShiftDigest] failed to write notification_log:", e);
  }

  return ok ? { ok: true } : { ok: false, error: errorMessage };
}

/**
 * Write a "skipped" audit row for an employee we deliberately didn't email
 * (notify_enabled=false, no email on contact, or no shifts in the next 8 days).
 * Useful for the manager to see why someone wasn't notified.
 */
export async function logSkippedNotification(args: {
  recipientEmployeeId: string;
  reason: string;
  cardIds: string[];
  assignmentIds: string[];
}): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("notification_log") as any).insert({
      channel: "email",
      recipient_employee_id: args.recipientEmployeeId,
      recipient_address: "(none)",
      subject: null,
      kind: "new_roster",
      related_card_ids: args.cardIds,
      related_assignment_ids: args.assignmentIds,
      status: "skipped",
      error: args.reason,
      triggered_by: user?.id ?? null,
    });
  } catch (e) {
    console.error("[logSkippedNotification] failed:", e);
  }
}
