import { supabase } from "@/integrations/supabase/client";

export type AssignShiftInput = {
  shiftId: string;
  caregiverId: string;
  careTypeCode?: string | null;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes?: string | null;
  method?: "manual" | "ai_suggested" | "auto_assigned";
};

export const toMinutes = (t: string) => {
  const [h, m] = (t || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const durationHours = (start: string, end: string) => {
  const diff = toMinutes(end) - toMinutes(start);
  return Math.round((diff / 60) * 100) / 100;
};

/**
 * Single write path for assigning a caregiver to a shift.
 * Keeps shifts.caregiver_id/status and shift_assignments in sync.
 */
export async function assignShift(input: AssignShiftInput) {
  const {
    shiftId,
    caregiverId,
    careTypeCode,
    startTime,
    endTime,
    notes,
    method = "manual",
  } = input;

  const hours = durationHours(startTime, endTime);
  if (hours <= 0) throw new Error("End time must be after start time");

  const { error: shiftError } = await supabase
    .from("shifts")
    .update({
      caregiver_id: caregiverId,
      status: "assigned" as never,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      duration_hours: hours,
      ...(careTypeCode ? { care_type_code: careTypeCode } : {}),
    })
    .eq("id", shiftId);
  if (shiftError) throw shiftError;

  const { data: existing, error: existingError } = await supabase
    .from("shift_assignments")
    .select("id")
    .eq("shift_id", shiftId)
    .limit(1);
  if (existingError) throw existingError;

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("shift_assignments")
      .update({
        caregiver_id: caregiverId,
        status: "scheduled" as never,
        assignment_method: method as never,
        notes: notes || null,
      })
      .eq("id", existing[0].id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("shift_assignments").insert({
      shift_id: shiftId,
      caregiver_id: caregiverId,
      status: "scheduled" as never,
      assignment_method: method as never,
      notes: notes || null,
    });
    if (error) throw error;
  }
}

/** Returns human-readable warnings for a proposed assignment. */
export async function checkAssignmentConflicts(params: {
  caregiverId: string;
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}): Promise<string[]> {
  const warnings: string[] = [];
  const { caregiverId, shiftId, shiftDate, startTime, endTime } = params;

  const { data: sameDay } = await supabase
    .from("shifts")
    .select("id, start_time, end_time")
    .eq("caregiver_id", caregiverId)
    .eq("shift_date", shiftDate)
    .neq("id", shiftId);

  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  (sameDay || []).forEach((other: any) => {
    const os = toMinutes((other.start_time || "").slice(0, 5));
    const oe = toMinutes((other.end_time || "").slice(0, 5));
    if (s < oe && os < e) {
      warnings.push(
        `Overlaps an existing shift ${(other.start_time || "").slice(0, 5)}–${(other.end_time || "").slice(0, 5)} on this day.`
      );
    }
  });

  const { data: timeOff } = await supabase
    .from("time_off_requests")
    .select("id, start_date, end_date, status")
    .eq("caregiver_id", caregiverId)
    .eq("status", "approved" as never)
    .lte("start_date", shiftDate)
    .gte("end_date", shiftDate);

  if (timeOff && timeOff.length > 0) {
    warnings.push("Caregiver has approved time off covering this date.");
  }

  return warnings;
}
