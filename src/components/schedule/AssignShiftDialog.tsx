import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CalendarDays, Clock, Loader2, MapPin, User } from "lucide-react";
import {
  assignShift,
  checkAssignmentConflicts,
  durationHours,
} from "@/lib/shiftAssignment";

interface AssignShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: any | null;
  /** Preselected caregiver id (e.g. from an AI match). */
  defaultCaregiverId?: string | null;
  /** Optional decision context from AI matching. */
  matchContext?: { score?: number; factors?: string[]; warnings?: string[] } | null;
  onAssigned?: () => void;
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

export const AssignShiftDialog = ({
  open,
  onOpenChange,
  shift,
  defaultCaregiverId,
  matchContext,
  onAssigned,
}: AssignShiftDialogProps) => {
  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [caregiverId, setCaregiverId] = useState<string>("");
  const [careTypeCode, setCareTypeCode] = useState<string>("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const client = shift?.clients || shift?.client;

  useEffect(() => {
    if (!open || !shift) return;
    setCaregiverId(defaultCaregiverId || shift.caregiver_id || "");
    setCareTypeCode(shift.care_type_code || "");
    setStartTime(hhmm(shift.start_time));
    setEndTime(hhmm(shift.end_time));
    setNotes("");
    setConflicts([]);
    setSearch("");

    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();

      const [{ data: cgs }, { data: cts }] = await Promise.all([
        supabase
          .from("caregivers")
          .select("id, first_name, last_name, performance_rating, city, state, hourly_rate")
          .eq("agency_id", profile?.agency_id ?? "")
          .eq("is_active", true)
          .order("first_name"),
        supabase
          .from("care_types")
          .select("code, name")
          .eq("is_active", true)
          .order("name"),
      ]);
      setCaregivers(cgs || []);
      setCareTypes(cts || []);
      setLoading(false);
    };
    load();
  }, [open, shift, defaultCaregiverId]);

  const hours = useMemo(
    () => (startTime && endTime ? durationHours(startTime, endTime) : 0),
    [startTime, endTime]
  );

  // Re-check conflicts whenever the proposal changes.
  useEffect(() => {
    if (!open || !shift || !caregiverId || hours <= 0) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    checkAssignmentConflicts({
      caregiverId,
      shiftId: shift.id,
      shiftDate: shift.shift_date,
      startTime,
      endTime,
    })
      .then((w) => !cancelled && setConflicts(w))
      .catch(() => !cancelled && setConflicts([]));
    return () => {
      cancelled = true;
    };
  }, [open, shift, caregiverId, startTime, endTime, hours]);

  const filteredCaregivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return caregivers;
    return caregivers.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
    );
  }, [caregivers, search]);

  const handleConfirm = async () => {
    if (!shift) return;
    if (!caregiverId) {
      toast.error("Select a caregiver");
      return;
    }
    if (hours <= 0) {
      toast.error("End time must be after start time");
      return;
    }
    setSaving(true);
    try {
      await assignShift({
        shiftId: shift.id,
        caregiverId,
        careTypeCode: careTypeCode || null,
        startTime,
        endTime,
        notes,
        method: defaultCaregiverId === caregiverId && matchContext ? "ai_suggested" : "manual",
      });
      toast.success("Shift assigned");
      onOpenChange(false);
      onAssigned?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to assign shift");
    } finally {
      setSaving(false);
    }
  };

  if (!shift) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Shift</DialogTitle>
          <DialogDescription>
            Confirm the caregiver, care type and times before saving this assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Read-only context */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              {client?.first_name} {client?.last_name}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {shift.shift_date
                ? format(parseISO(shift.shift_date), "EEEE, MMMM d, yyyy")
                : "—"}
            </div>
            {client?.city && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {client.city}
                {client.state ? `, ${client.state}` : ""}
              </div>
            )}
          </div>

          {matchContext && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
              {typeof matchContext.score === "number" && (
                <Badge className="mb-1">{matchContext.score}% AI match</Badge>
              )}
              {matchContext.factors?.length ? (
                <ul className="list-disc list-inside text-muted-foreground">
                  {matchContext.factors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label>Caregiver *</Label>
            <Input
              placeholder="Search caregivers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={caregiverId} onValueChange={setCaregiverId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading..." : "Select a caregiver"} />
              </SelectTrigger>
              <SelectContent>
                {filteredCaregivers.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No caregivers found
                  </SelectItem>
                ) : (
                  filteredCaregivers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.performance_rating ? ` • ★ ${c.performance_rating}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Care type</Label>
            <Select value={careTypeCode} onValueChange={setCareTypeCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select care type" />
              </SelectTrigger>
              <SelectContent>
                {careTypes.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start time *</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End time *</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {hours > 0 ? (
              <span>Duration: {hours} hour{hours === 1 ? "" : "s"}</span>
            ) : (
              <span className="text-destructive">End time must be after start time</span>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-warning mb-1">
                <AlertTriangle className="h-4 w-4" />
                Scheduling warnings
              </div>
              <ul className="list-disc list-inside text-muted-foreground">
                {conflicts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the caregiver should know..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !caregiverId || hours <= 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
