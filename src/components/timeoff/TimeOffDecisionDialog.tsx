import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { queueNotification } from "@/lib/notifications";
import { releaseShiftAssignments } from "@/lib/shiftAssignment";

type Decision = "approved" | "denied";

interface Props {
  request: any | null;
  decision: Decision;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function TimeOffDecisionDialog({ request, decision, open, onOpenChange, onDone }: Props) {
  const [note, setNote] = useState("");
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<"release" | "trade" | "keep">("release");

  useEffect(() => {
    if (!open || !request) return;
    setNote("");
    setAction("release");
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("shifts")
        .select("id, shift_date, start_time, end_time, duration_hours, order_title, agency_id")
        .eq("caregiver_id", request.caregiver_id)
        .gte("shift_date", request.start_date)
        .lte("shift_date", request.end_date)
        .order("shift_date");
      setConflicts(data || []);
      setLoading(false);
    })();
  }, [open, request]);

  const submit = async () => {
    if (!request) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("time_off_requests")
        .update({
          status: decision as never,
          notes: note || null,
          approved_by_user_id: user?.id ?? null,
        })
        .eq("id", request.id);
      if (error) throw error;

      if (decision === "approved" && conflicts.length > 0 && action !== "keep") {
        const shiftIds = conflicts.map((s) => s.id);

        if (action === "release") {
          // Assignments are trigger-protected: release runs server-side.
          await releaseShiftAssignments(
            shiftIds,
            `Released for approved time off ${request.start_date} – ${request.end_date}`
          );
        } else {
          const { data: assignments } = await supabase
            .from("shift_assignments")
            .select("id, shift_id")
            .in("shift_id", shiftIds);
          const rows = (assignments || []).map((a: any) => ({
            shift_assignment_id: a.id,
            shift_id: a.shift_id,
            original_caregiver_id: request.caregiver_id,
            status: "pending" as never,
            trade_type: "trade_board" as never,
            reason: `Approved time off ${request.start_date} – ${request.end_date}`,
          }));
          if (rows.length > 0) await supabase.from("shift_trades").insert(rows as never);
        }
      }

      const email = request.caregivers?.email;
      if (email) {
        await queueNotification({
          agencyId: conflicts[0]?.agency_id ?? null,
          recipientEmail: email,
          recipientName: `${request.caregivers?.first_name ?? ""} ${request.caregivers?.last_name ?? ""}`.trim(),
          kind: `time_off_${decision}`,
          subject: `Your time off request was ${decision}`,
          body: `Your ${request.request_type} request for ${request.start_date} – ${request.end_date} was ${decision}.${
            note ? `\n\nManager note: ${note}` : ""
          }`,
          payload: { request_id: request.id, decision, affected_shifts: conflicts.length },
        });
      }

      toast.success(decision === "approved" ? "Time off approved" : "Time off denied");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Could not save the decision");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{decision === "approved" ? "Approve" : "Deny"} time off</DialogTitle>
          <DialogDescription>
            {request?.caregivers?.first_name} {request?.caregivers?.last_name} ·{" "}
            {request?.start_date} → {request?.end_date}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking scheduled shifts…
            </div>
          ) : conflicts.length > 0 ? (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-warning">
                <AlertTriangle className="h-4 w-4" />
                {conflicts.length} scheduled shift{conflicts.length === 1 ? "" : "s"} inside this range
              </div>
              <div className="space-y-1 max-h-32 overflow-auto">
                {conflicts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span>
                      {s.shift_date} · {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {s.order_title}
                    </Badge>
                  </div>
                ))}
              </div>
              {decision === "approved" && (
                <RadioGroup value={action} onValueChange={(v) => setAction(v as any)} className="pt-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="release" id="release" />
                    <Label htmlFor="release" className="text-sm font-normal">
                      Release them back to Unassigned
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="trade" id="trade" />
                    <Label htmlFor="trade" className="text-sm font-normal">
                      Post them to the Trade Board
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="keep" id="keep" />
                    <Label htmlFor="keep" className="text-sm font-normal">
                      Leave assigned (I'll handle it manually)
                    </Label>
                  </div>
                </RadioGroup>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scheduled shifts fall inside this range.</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Manager note {decision === "denied" && <span className="text-destructive">*</span>}</Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={decision === "approved" ? "Optional note to the caregiver…" : "Explain why this is denied…"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || (decision === "denied" && note.trim().length === 0)}
            variant={decision === "denied" ? "destructive" : "default"}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm {decision === "approved" ? "approval" : "denial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}