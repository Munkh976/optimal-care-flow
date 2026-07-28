import { supabase } from "@/integrations/supabase/client";

/**
 * Queues a notification instead of sending a real email.
 * Rows land in the Notifications Outbox until a mail provider is wired up.
 */
export async function queueNotification(params: {
  agencyId?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  kind: string;
  subject: string;
  body: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("pending_notifications").insert({
    agency_id: params.agencyId ?? null,
    recipient_email: params.recipientEmail,
    recipient_name: params.recipientName ?? null,
    kind: params.kind,
    subject: params.subject,
    body: params.body,
    payload: (params.payload ?? {}) as never,
  });
  if (error) console.error("Failed to queue notification", error);
}