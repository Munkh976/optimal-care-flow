export interface VirtualOfficeRow {
  id: string;
  agency_id: string;
  name: string;
  code: string | null;
  is_primary: boolean;
  is_active: boolean;
  timezone: string;
  branding: any;
  service_states: string[] | null;
  service_zipcodes: string[] | null;
  service_area: any;
  operating_hours: any;
  max_weekly_hours: number | null;
  travel_buffer_minutes: number | null;
  late_trade_hours: number | null;
  smart_match_weights: any;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

export interface Branding {
  display_name?: string;
  tagline?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface ServiceArea {
  radius_miles?: number | null;
  center_zip?: string | null;
  notes?: string;
}

export interface DayHours {
  closed: boolean;
  start: string;
  end: string;
}

export type OperatingHours = Record<string, DayHours>;

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const defaultDay = (): DayHours => ({ closed: true, start: "08:00", end: "18:00" });

export const normalizeHours = (raw: any): OperatingHours => {
  const out: OperatingHours = {};
  for (let i = 0; i < 7; i++) {
    const d = raw?.[String(i)];
    out[String(i)] = d
      ? { closed: !!d.closed, start: d.start || "08:00", end: d.end || "18:00" }
      : defaultDay();
  }
  return out;
};
