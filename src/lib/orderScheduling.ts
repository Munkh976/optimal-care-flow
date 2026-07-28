import { addDays, addMonths, differenceInCalendarWeeks, format, getDay, parseISO } from "date-fns";

export type OrderFrequency = "once" | "weekly" | "biweekly" | "monthly";

export interface OrderServiceLine {
  id?: string;
  care_type_code: string;
  care_type_name?: string;
  days_of_week: number[];
  start_time: string; // "HH:mm"
  end_time: string; // "HH:mm"
  frequency: OrderFrequency;
  notes?: string | null;
}

export interface GeneratedShift {
  lineIndex: number;
  care_type_code: string;
  shift_date: string; // yyyy-MM-dd
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  duration_hours: number;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DURATION_OPTIONS = [1, 2, 3, 6, 12];

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const durationHours = (start: string, end: string) =>
  Math.round(((toMinutes(end) - toMinutes(start)) / 60) * 100) / 100;

const asDate = (d: string | Date) => (typeof d === "string" ? parseISO(d) : d);

/** Nth occurrence (1-based) of this weekday within its own month. */
const weekOfMonth = (d: Date) => Math.floor((d.getDate() - 1) / 7) + 1;

export function computeEndDate(startDate: string | Date, months: number) {
  return format(addDays(addMonths(asDate(startDate), months), -1), "yyyy-MM-dd");
}

/**
 * Expand order service lines into concrete shift rows between start and end (inclusive).
 * - once      -> first matching weekday only (per line)
 * - weekly    -> every matching weekday
 * - biweekly  -> matching weekdays on alternating weeks anchored to the start date
 * - monthly   -> matching weekday on the same week-of-month as the first occurrence
 */
export function generateShifts(
  lines: OrderServiceLine[],
  startDate: string | Date,
  endDate: string | Date
): GeneratedShift[] {
  const start = asDate(startDate);
  const end = asDate(endDate);
  const out: GeneratedShift[] = [];

  lines.forEach((line, lineIndex) => {
    if (!line.days_of_week?.length || !line.start_time || !line.end_time) return;
    const hours = durationHours(line.start_time, line.end_time);
    if (hours <= 0) return;

    const anchors = new Map<number, Date>(); // first occurrence per weekday
    const doneOnce = new Set<number>();

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dow = getDay(d);
      if (!line.days_of_week.includes(dow)) continue;

      if (!anchors.has(dow)) anchors.set(dow, new Date(d));
      const anchor = anchors.get(dow)!;

      if (line.frequency === "once") {
        if (doneOnce.has(dow)) continue;
        doneOnce.add(dow);
      } else if (line.frequency === "biweekly") {
        if (differenceInCalendarWeeks(d, anchor) % 2 !== 0) continue;
      } else if (line.frequency === "monthly") {
        if (weekOfMonth(d) !== weekOfMonth(anchor)) continue;
      }

      out.push({
        lineIndex,
        care_type_code: line.care_type_code,
        shift_date: format(d, "yyyy-MM-dd"),
        start_time: line.start_time,
        end_time: line.end_time,
        duration_hours: hours,
      });
    }
  });

  return out.sort((a, b) =>
    a.shift_date === b.shift_date
      ? a.start_time.localeCompare(b.start_time)
      : a.shift_date.localeCompare(b.shift_date)
  );
}

export interface ScheduleConflict {
  shift_date: string;
  a: GeneratedShift;
  b: GeneratedShift;
}

/** Same-client time overlaps between generated shifts (usually across different lines). */
export function findConflicts(shifts: GeneratedShift[]): ScheduleConflict[] {
  const byDate = new Map<string, GeneratedShift[]>();
  shifts.forEach((s) => {
    const list = byDate.get(s.shift_date) || [];
    list.push(s);
    byDate.set(s.shift_date, list);
  });

  const conflicts: ScheduleConflict[] = [];
  byDate.forEach((list, date) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (toMinutes(a.start_time) < toMinutes(b.end_time) && toMinutes(b.start_time) < toMinutes(a.end_time)) {
          conflicts.push({ shift_date: date, a, b });
        }
      }
    }
  });
  return conflicts;
}

export function summarizeLine(line: OrderServiceLine) {
  const days = [...line.days_of_week].sort().map((d) => DAY_NAMES[d]).join("/");
  const label = line.care_type_name || line.care_type_code;
  const freq = line.frequency === "once" ? "one time" : line.frequency;
  return `${label} · ${days || "no days"} ${line.start_time}–${line.end_time} · ${freq}`;
}
