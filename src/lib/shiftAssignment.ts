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
 * All eligibility enforcement lives in the database: this calls the
 * SECURITY DEFINER function `assign_caregiver_to_shift`, which refuses hard
 * blockers outright and demands an override reason for soft blockers.
 * Direct writes to shift_assignments are blocked by RLS + trigger.
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
    overrideReason,
  } = input;

  const hours = durationHours(startTime, endTime);
  if (hours <= 0) throw new Error("End time must be after start time");

  // Shift details first so the server evaluates eligibility against final times.
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

  const { data, error } = await supabase.rpc("assign_caregiver_to_shift" as never, {
    _shift_id: shiftId,
    _caregiver_id: caregiverId,
    _method: method,
    _notes: notes || null,
    _override_reason: overrideReason?.trim() || null,
  } as never);

  if (error) {
    if (/override reason required/i.test(error.message)) {
      throw new OverrideRequiredError(
        error.message.replace(/^Override reason required:\s*/i, "")
      );
    }
    throw new Error(error.message.replace(/^Assignment refused:\s*/i, ""));
  }
  return data as unknown as {
    assignment_id: string;
    overridden: boolean;
    eligibility: unknown;
  };
}

/** Caregiver self pick-up of an open shift. No overrides are possible. */
export async function pickUpShift(shiftId: string) {
  const { data, error } = await supabase.rpc("caregiver_pick_up_shift" as never, {
    _shift_id: shiftId,
  } as never);
  if (error) throw new Error(error.message.replace(/^Pick-up refused:\s*/i, ""));
  return data;
}

/** Staff-only release of caregivers from shifts (e.g. approved time off). */
export async function releaseShiftAssignments(shiftIds: string[], reason?: string) {
  if (!shiftIds.length) return 0;
  const { data, error } = await supabase.rpc("release_shift_assignments" as never, {
    _shift_ids: shiftIds,
    _reason: reason || null,
  } as never);
  if (error) throw error;
  return (data as unknown as number) ?? 0;
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
