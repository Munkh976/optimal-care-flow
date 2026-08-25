/**
 * Hours Delivered — pure utilization math (HOURS ONLY).
 * No rates, no dollars, no earnings, no payroll. Do not add them here.
 *
 * ASSIGNED = sum of duration_hours for NON-CANCELLED shifts (shift.status <> 'cancelled')
 *            with a NON-CANCELLED assignment, that have ALREADY OCCURRED in the period.
 * ACTUAL   = sum of approved, non-voided time_entries.hours_worked by started_at in the period.
 * GAP      = assigned - actual (positive = under-delivery).
 * RATIO    = actual / assigned, only when assigned > 0.
 */

export type ShiftRow = {
  id: string;
  shift_date: string;
  end_time: string | null;
  duration_hours: number | string | null;
  status: string | null;
  shift_assignments?: { caregiver_id: string | null; status: string | null }[] | null;
};

export type TimeEntryRow = {
  caregiver_id: string;
  hours_worked: number | string | null;
  started_at: string;
  status: string | null;
  voided_at: string | null;
};

export type CaregiverRow = {
  id: string;
  first_name: string;
  last_name: string;
  virtual_office_id: string | null;
};

export const UNASSIGNED_OFFICE = "__unassigned__";

export type CaregiverHours = {
  caregiverId: string;
  caregiverName: string;
  officeId: string;
  officeName: string;
  assignedHours: number;
  actualHours: number;
  scheduledAheadHours: number;
  occurredShiftCount: number;
  /** honest state for rendering */
  state: "measured" | "not_yet_worked" | "no_actuals" | "unassigned_actuals";
};

export type OfficeTotals = {
  officeId: string;
  officeName: string;
  assignedHours: number;
  actualHours: number;
  scheduledAheadHours: number;
  caregiverCount: number;
  anyOccurred: boolean;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A shift counts as "occurred" only when its end moment is in the past. */
export function hasOccurred(shift: ShiftRow, now: Date): boolean {
  const end = shift.end_time ? String(shift.end_time).slice(0, 8) : "23:59:59";
  const endsAt = new Date(`${shift.shift_date}T${end}`);
  if (Number.isNaN(endsAt.getTime())) return false;
  return endsAt.getTime() <= now.getTime();
}

/** Cancellation is excluded on BOTH sides: the shift and the assignment. */
export function activeAssignmentsOf(shift: ShiftRow) {
  if (String(shift.status || "") === "cancelled") return [];
  return (shift.shift_assignments || []).filter(
    (a) => a && a.caregiver_id && String(a.status || "") !== "cancelled"
  );
}

export function isCountableTimeEntry(te: TimeEntryRow) {
  return String(te.status || "") === "approved" && !te.voided_at;
}

export function computeHoursDelivered(params: {
  shifts: ShiftRow[];
  timeEntries: TimeEntryRow[];
  caregivers: CaregiverRow[];
  officeNames: Map<string, string>;
  now?: Date;
}): { rows: CaregiverHours[]; offices: OfficeTotals[]; overall: OfficeTotals } {
  const { shifts, timeEntries, caregivers, officeNames } = params;
  const now = params.now ?? new Date();

  const cgById = new Map(caregivers.map((c) => [c.id, c]));
  const acc = new Map<
    string,
    { assigned: number; actual: number; ahead: number; occurred: number }
  >();
  const bump = (id: string) => {
    let e = acc.get(id);
    if (!e) {
      e = { assigned: 0, actual: 0, ahead: 0, occurred: 0 };
      acc.set(id, e);
    }
    return e;
  };

  for (const s of shifts) {
    const hours = num(s.duration_hours);
    const occurred = hasOccurred(s, now);
    for (const a of activeAssignmentsOf(s)) {
      const e = bump(a.caregiver_id as string);
      if (occurred) {
        e.assigned += hours;
        e.occurred += 1;
      } else {
        e.ahead += hours;
      }
    }
  }

  for (const te of timeEntries) {
    if (!isCountableTimeEntry(te)) continue;
    bump(te.caregiver_id).actual += num(te.hours_worked);
  }

  const rows: CaregiverHours[] = [];
  for (const [caregiverId, e] of acc) {
    if (e.assigned === 0 && e.actual === 0 && e.ahead === 0) continue;
    const cg = cgById.get(caregiverId);
    const officeId = cg?.virtual_office_id || UNASSIGNED_OFFICE;
    let state: CaregiverHours["state"] = "measured";
    if (e.assigned === 0 && e.actual > 0) state = "unassigned_actuals";
    else if (e.assigned === 0 && e.ahead > 0) state = "not_yet_worked";
    else if (e.assigned > 0 && e.actual === 0) state = "no_actuals";

    rows.push({
      caregiverId,
      caregiverName: cg ? `${cg.first_name} ${cg.last_name}` : "Unknown caregiver",
      officeId,
      officeName:
        officeId === UNASSIGNED_OFFICE
          ? "Unassigned office"
          : officeNames.get(officeId) || "Unknown office",
      assignedHours: round2(e.assigned),
      actualHours: round2(e.actual),
      scheduledAheadHours: round2(e.ahead),
      occurredShiftCount: e.occurred,
      state,
    });
  }

  rows.sort((a, b) => gapOf(b) - gapOf(a) || a.caregiverName.localeCompare(b.caregiverName));

  const officeMap = new Map<string, OfficeTotals>();
  for (const r of rows) {
    let o = officeMap.get(r.officeId);
    if (!o) {
      o = {
        officeId: r.officeId,
        officeName: r.officeName,
        assignedHours: 0,
        actualHours: 0,
        scheduledAheadHours: 0,
        caregiverCount: 0,
        anyOccurred: false,
      };
      officeMap.set(r.officeId, o);
    }
    o.assignedHours = round2(o.assignedHours + r.assignedHours);
    o.actualHours = round2(o.actualHours + r.actualHours);
    o.scheduledAheadHours = round2(o.scheduledAheadHours + r.scheduledAheadHours);
    o.caregiverCount += 1;
    o.anyOccurred = o.anyOccurred || r.occurredShiftCount > 0;
  }

  const offices = [...officeMap.values()].sort((a, b) =>
    a.officeName.localeCompare(b.officeName)
  );

  const overall: OfficeTotals = {
    officeId: "__all__",
    officeName: "All offices",
    assignedHours: round2(offices.reduce((s, o) => s + o.assignedHours, 0)),
    actualHours: round2(offices.reduce((s, o) => s + o.actualHours, 0)),
    scheduledAheadHours: round2(offices.reduce((s, o) => s + o.scheduledAheadHours, 0)),
    caregiverCount: rows.length,
    anyOccurred: offices.some((o) => o.anyOccurred),
  };

  return { rows, offices, overall };
}

export function gapOf(r: { assignedHours: number; actualHours: number }) {
  return round2(r.assignedHours - r.actualHours);
}

/** Ratio is only meaningful when assigned > 0; null means "do not display a number". */
export function ratioOf(r: { assignedHours: number; actualHours: number }): number | null {
  if (!(r.assignedHours > 0)) return null;
  return r.actualHours / r.assignedHours;
}

export const fmtHours = (n: number) => `${n.toFixed(1)} h`;
