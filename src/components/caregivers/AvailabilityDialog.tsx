import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";

interface AvailabilityDialogProps {
  caregiver: any;
  isOpen: boolean;
  onClose: () => void;
}

interface TimeSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export const AvailabilityDialog = ({ caregiver, isOpen, onClose }: AvailabilityDialogProps) => {
  const [availability, setAvailability] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  const daysOfWeek = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 0, label: "Sunday" },
  ];

  useEffect(() => {
    if (isOpen && caregiver) {
      fetchAvailability();
    }
  }, [isOpen, caregiver]);

  const fetchAvailability = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("caregiver_availability")
      .select("*")
      .eq("caregiver_id", caregiver.id)
      .order("day_of_week");

    if (error) {
      console.error("Error fetching availability:", error);
      toast.error("Failed to load availability");
    } else {
      if (data && data.length > 0) {
        const normalizeTime = (t: string) => (typeof t === "string" ? t.slice(0, 5) : t);
        const normalized = (data as any[]).map((slot) => ({
          ...slot,
          start_time: normalizeTime(slot.start_time as string),
          end_time: normalizeTime(slot.end_time as string),
          is_available: slot.is_available ?? true,
        }));
        setAvailability(normalized as any);
      } else {
        const emptySlots = daysOfWeek.map((day) => ({
          day_of_week: day.value,
          start_time: "09:00",
          end_time: "17:00",
          is_available: false,
        }));
        setAvailability(emptySlots);
      }
    }
    setLoading(false);
  };

  const handleToggleDay = (dayValue: number) => {
    setAvailability((prev) => {
      const existing = prev.find((slot) => slot.day_of_week === dayValue);
      if (existing) {
        return prev.map((slot) =>
          slot.day_of_week === dayValue
            ? { ...slot, is_available: !slot.is_available }
            : slot
        );
      } else {
        return [
          ...prev,
          {
            day_of_week: dayValue,
            start_time: "09:00",
            end_time: "17:00",
            is_available: true,
          },
        ];
      }
    });
  };

  const handleTimeChange = (
    dayValue: number,
    field: "start_time" | "end_time",
    value: string
  ) => {
    setAvailability((prev) =>
      prev.map((slot) =>
        slot.day_of_week === dayValue ? { ...slot, [field]: value } : slot
      )
    );
  };

  const handleSave = async () => {
    setLoading(true);
    
    // Delete existing availability
    await supabase
      .from("caregiver_availability")
      .delete()
      .eq("caregiver_id", caregiver.id);

    // Insert only available slots
    const slotsToInsert = availability
      .filter((slot) => slot.is_available)
      .map((slot) => ({
        caregiver_id: caregiver.id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: true,
      }));

    if (slotsToInsert.length > 0) {
      const { error } = await supabase
        .from("caregiver_availability")
        .insert(slotsToInsert);

      if (error) {
        console.error("Error saving availability:", error);
        toast.error("Failed to save availability");
        setLoading(false);
        return;
      }
    }

    toast.success("Availability updated successfully");
    setLoading(false);
    onClose();
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        times.push(time);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Manage Availability - {caregiver?.first_name} {caregiver?.last_name}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {daysOfWeek.map((day) => {
            const slot = availability.find((s) => s.day_of_week === day.value);
            const isAvailable = slot?.is_available || false;

            return (
              <div
                key={day.value}
                className="flex items-center gap-4 p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-2 w-32">
                  <input
                    type="checkbox"
                    id={`day-${day.value}`}
                    checked={isAvailable}
                    onChange={() => handleToggleDay(day.value)}
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor={`day-${day.value}`}
                    className="font-medium cursor-pointer"
                  >
                    {day.label}
                  </Label>
                </div>

                {isAvailable && (
                  <div className="flex items-center gap-2 flex-1">
                    <Select
                      value={slot?.start_time || "09:00"}
                      onValueChange={(value) =>
                        handleTimeChange(day.value, "start_time", value)
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Start" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="text-muted-foreground">to</span>

                    <Select
                      value={slot?.end_time || "17:00"}
                      onValueChange={(value) =>
                        handleTimeChange(day.value, "end_time", value)
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="End" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Availability"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
