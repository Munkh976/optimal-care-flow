import { supabase } from "@/integrations/supabase/client";

export type AssignShiftInput = {
  shiftId: string;
  caregiverId: string;
  careTypeCode?: string | null;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes?: string | null;
  method?: "manual" | "ai_suggested" | "auto_assigned";
  /** Required when the server reports SOFT blockers (weekly cap, time off, availability). */
  overrideReason?: string | null;
};

/** Thrown when the database refuses an assignment because a soft rule needs an override. */
export class OverrideRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverrideRequiredError";
  }
}

export const toMinutes = (t: string) => {
  const [h, m] = (t || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const durationHours = (start: string, end: string) => {
  const diff = toMinutes(end) - toMinutes(start);
  return Math.round((diff / 60) * 100) / 100;
};

/**
 * shift_assignments is the single source of truth for who works a shift.
 * `shifts.caregiver_id` is a derived/deprecated column maintained by a database
 * trigger — never write it from the client, never read it in the UI.
 */
export const isActiveAssignment = (a: any) => a && a.status !== "cancelled";

/** Resolves the caregiver of a shift from its embedded shift_assignments rows. */
export const assignedCaregiverId = (shift: any): string | null => {
  const assignments = (shift?.shift_assignments || []).filter(isActiveAssignment);
  if (!assignments.length) return null;
  const completed = assignments.find((a: any) => a.status === "completed");
  return (completed || assignments[0]).caregiver_id ?? null;
};

/**
 * Single write path for assigning a caregiver to a shift.
 * Writes the assignment; shifts.caregiver_id/status follow via database trigger.
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

  const { data: existing, error: existingError } = await supabase
    .from("shift_assignments")
    .select("id, status")
    .eq("shift_id", shiftId)
    .neq("status", "completed" as never)
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

  const { error: shiftError } = await supabase
    .from("shifts")
    .update({
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      duration_hours: hours,
      ...(careTypeCode ? { care_type_code: careTypeCode } : {}),
    })
    .eq("id", shiftId);
  if (shiftError) throw shiftError;
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

  const { data: sameDayAssignments } = await supabase
    .from("shift_assignments")
    .select("shift_id, status, shifts!inner ( id, start_time, end_time, shift_date )")
    .eq("caregiver_id", caregiverId)
    .neq("status", "cancelled" as never)
    .eq("shifts.shift_date", shiftDate);

  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  (sameDayAssignments || []).forEach((row: any) => {
    const other = row.shifts;
    if (!other || other.id === shiftId) return;
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
