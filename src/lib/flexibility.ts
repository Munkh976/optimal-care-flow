/**
 * SINGLE resolution rule for "effective client flexibility" and time windows.
 *
 * Durable client value (clients.scheduling_flexibility / client_time_windows) if set
 *   -> else the latest care_request's flexibility / care_request_time_windows
 *   -> else unset (null).
 *
 * Display + edit only. No scheduling engine, matcher, or eligibility rule reads this.
 * Reuse this helper everywhere; never resolve the fallback ad hoc in a component.
 */

export type FlexibilityStance = "continuity" | "balanced" | "flexible";

export const FLEXIBILITY_OPTIONS: { value: FlexibilityStance; label: string; hint: string }[] = [
  { value: "continuity", label: "Continuity first", hint: "Same caregiver matters more than timing" },
  { value: "balanced", label: "Balanced", hint: "Some give on both timing and caregiver" },
  { value: "flexible", label: "Flexible", hint: "Timing and caregiver can move to get coverage" },
];

export interface TimeWindowLike {
  day_of_week: number;
  preferred_start: string | null;
  preferred_end: string | null;
  earliest_start?: string | null;
  latest_end?: string | null;
  notes?: string | null;
}

export type FlexibilitySource = "client" | "care_request" | "unset";

export interface EffectiveFlexibility {
  flexibility: string | null;
  windows: TimeWindowLike[];
  /** Where the resolved values came from — useful for staff-facing hints. */
  source: FlexibilitySource;
  windowsSource: FlexibilitySource;
}

export const resolveClientFlexibility = (input: {
  clientFlexibility?: string | null;
  clientWindows?: TimeWindowLike[] | null;
  requestFlexibility?: string | null;
  requestWindows?: TimeWindowLike[] | null;
}): EffectiveFlexibility => {
  const clientWindows = input.clientWindows ?? [];
  const requestWindows = input.requestWindows ?? [];

  const flexibility = input.clientFlexibility ?? input.requestFlexibility ?? null;
  const source: FlexibilitySource = input.clientFlexibility
    ? "client"
    : input.requestFlexibility
      ? "care_request"
      : "unset";

  const windows = clientWindows.length > 0 ? clientWindows : requestWindows;
  const windowsSource: FlexibilitySource =
    clientWindows.length > 0 ? "client" : requestWindows.length > 0 ? "care_request" : "unset";

  return { flexibility, windows, source, windowsSource };
};
