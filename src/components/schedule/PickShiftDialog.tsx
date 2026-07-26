import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caregiver: any | null;
  shifts: any[];
  onPick: (shift: any) => void;
}

export const PickShiftDialog = ({
  open,
  onOpenChange,
  caregiver,
  shifts,
  onPick,
}: Props) => {
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...shifts].sort((a, b) =>
      (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time)
    );
    if (!q) return sorted;
    return sorted.filter((s) =>
      [s.clients?.first_name, s.clients?.last_name, s.care_types?.name, s.order_title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [shifts, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign a shift to {caregiver?.first_name} {caregiver?.last_name}
          </DialogTitle>
          <DialogDescription>
            Pick an unassigned shift in the selected period, then confirm the details.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search client or service..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-2">
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No unassigned shifts in this period.
            </p>
          ) : (
            results.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                className="w-full h-auto justify-start py-2.5 text-left"
                onClick={() => onPick(s)}
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {format(parseISO(s.shift_date), "EEE, MMM d")} ·{" "}
                    {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.clients?.first_name} {s.clients?.last_name} ·{" "}
                    {s.care_types?.name || s.order_title || "—"}
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
