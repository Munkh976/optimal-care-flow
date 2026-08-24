import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock } from "lucide-react";
import { FLEXIBILITY_OPTIONS } from "@/lib/flexibility";

interface Props {
  client: { id: string; agency_id: string; first_name: string; last_name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface WindowRow {
  id?: string;
  day_of_week: number;
  enabled: boolean;
  preferred_start: string;
  preferred_end: string;
  earliest_start: string;
  latest_end: string;
  notes: string;
}

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const UNSET = "__unset__";
const hhmm = (t?: string | null, fallback = "09:00") =>
  typeof t === "string" && t.length >= 5 ? t.slice(0, 5) : fallback;

const emptyRow = (day: number): WindowRow => ({
  day_of_week: day,
  enabled: false,
  preferred_start: "09:00",
  preferred_end: "17:00",
  earliest_start: "09:00",
  latest_end: "17:00",
  notes: "",
});

export const ClientSchedulingDialog = ({ client, open, onOpenChange, onSaved }: Props) => {
  const [flexibility, setFlexibility] = useState<string>(UNSET);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<WindowRow[]>(DAYS.map((d) => emptyRow(d.value)));
  const [requestFallback, setRequestFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !client) return;
    const load = async () => {
      setLoading(true);
      const [{ data: c }, { data: windows }, { data: reqs }] = await Promise.all([
        supabase
          .from("clients")
          .select("scheduling_flexibility, scheduling_notes")
          .eq("id", client.id)
          .maybeSingle(),
        supabase.from("client_time_windows").select("*").eq("client_id", client.id).order("day_of_week"),
        supabase
          .from("care_requests")
          .select("flexibility, created_at")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      setFlexibility(((c as any)?.scheduling_flexibility as string) ?? UNSET);
      setNotes(((c as any)?.scheduling_notes as string) ?? "");
      setRequestFallback((((reqs as any[]) ?? [])[0]?.flexibility as string) ?? null);

      const byDay = new Map<number, any>();
      ((windows as any[]) ?? []).forEach((w) => byDay.set(w.day_of_week, w));
      setRows(
        DAYS.map((d) => {
          const w = byDay.get(d.value);
          if (!w) return emptyRow(d.value);
          return {
            id: w.id,
            day_of_week: d.value,
            enabled: true,
            preferred_start: hhmm(w.preferred_start),
            preferred_end: hhmm(w.preferred_end, "17:00"),
            earliest_start: hhmm(w.earliest_start ?? w.preferred_start),
            latest_end: hhmm(w.latest_end ?? w.preferred_end, "17:00"),
            notes: w.notes ?? "",
          };
        })
      );
      setLoading(false);
    };
    load();
  }, [open, client]);

  const update = (day: number, patch: Partial<WindowRow>) =>
    setRows((prev) => prev.map((r) => (r.day_of_week === day ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    if (!client) return;
    setLoading(true);

    const { error: clientError } = await supabase
      .from("clients")
      .update({
        scheduling_flexibility: flexibility === UNSET ? null : flexibility,
        scheduling_notes: notes.trim() || null,
      } as any)
      .eq("id", client.id);

    if (clientError) {
      toast.error(clientError.message);
      setLoading(false);
      return;
    }

    // Replace the client's window set (intake care_request history is never touched).
    const { error: delError } = await supabase
      .from("client_time_windows")
      .delete()
      .eq("client_id", client.id);
    if (delError) {
      toast.error(delError.message);
      setLoading(false);
      return;
    }

    const payload = rows
      .filter((r) => r.enabled)
      .map((r) => ({
        client_id: client.id,
        agency_id: client.agency_id,
        day_of_week: r.day_of_week,
        preferred_start: r.preferred_start,
        preferred_end: r.preferred_end,
        earliest_start: r.earliest_start || r.preferred_start,
        latest_end: r.latest_end || r.preferred_end,
        notes: r.notes.trim() || null,
      }));

    if (payload.length > 0) {
      const { error } = await supabase.from("client_time_windows").insert(payload as any);
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    toast.success("Scheduling preferences saved");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Scheduling preferences — {client?.first_name} {client?.last_name}
          </DialogTitle>
          <DialogDescription>
            The ongoing, editable stance for this client. Original intake answers stay on the care request as
            history and are never overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Flexibility stance</Label>
          <Select value={flexibility} onValueChange={setFlexibility}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>Not specified</SelectItem>
              {FLEXIBILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label} — {o.hint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {flexibility === UNSET && requestFallback && (
            <p className="text-xs text-muted-foreground">
              Not set on the client — Care Circle currently falls back to the intake request value “
              {requestFallback}”.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Scheduling notes</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. prefers mornings, no Fridays after 2pm"
          />
        </div>

        <div className="space-y-3">
          <Label>Weekly time windows</Label>
          {DAYS.map((d) => {
            const row = rows.find((r) => r.day_of_week === d.value) ?? emptyRow(d.value);
            return (
              <div key={d.value} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`cday-${d.value}`}
                    className="h-4 w-4"
                    checked={row.enabled}
                    onChange={() => update(d.value, { enabled: !row.enabled })}
                  />
                  <Label htmlFor={`cday-${d.value}`} className="cursor-pointer font-medium">
                    {d.label}
                  </Label>
                </div>
                {row.enabled && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Preferred from</Label>
                      <Input
                        type="time"
                        className="w-[130px]"
                        value={row.preferred_start}
                        onChange={(e) => update(d.value, { preferred_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Preferred to</Label>
                      <Input
                        type="time"
                        className="w-[130px]"
                        value={row.preferred_end}
                        onChange={(e) => update(d.value, { preferred_end: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Earliest</Label>
                      <Input
                        type="time"
                        className="w-[130px]"
                        value={row.earliest_start}
                        onChange={(e) => update(d.value, { earliest_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Latest</Label>
                      <Input
                        type="time"
                        className="w-[130px]"
                        value={row.latest_end}
                        onChange={(e) => update(d.value, { latest_end: e.target.value })}
                      />
                    </div>
                    <Input
                      placeholder="Note (optional)"
                      className="min-w-[180px] flex-1"
                      value={row.notes}
                      onChange={(e) => update(d.value, { notes: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
