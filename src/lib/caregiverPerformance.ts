import { supabase } from "@/integrations/supabase/client";

/**
 * SINGLE SOURCE OF TRUTH for caregiver rating / performance.
 *
 * Ratings are computed from `shift_ratings` through the security_invoker view
 * `caregiver_performance`. `caregivers.performance_rating` is deprecated and
 * frozen at the database level — never read or write it.
 */
export interface CaregiverPerformance {
  caregiver_id: string;
  agency_id: string | null;
  avg_rating: number | null;
  rating_count: number;
  avg_rating_90d: number | null;
  rating_count_90d: number;
  lifetime_completed: number;
  lifetime_no_shows: number;
  lifetime_cancelled: number;
  completion_rate: number | null;
  on_time_rate: number | null;
  shifts_last_30d: number;
  hours_last_30d: number;
  lifetime_hours: number;
}

const toNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const normalize = (row: any): CaregiverPerformance => ({
  caregiver_id: row.caregiver_id,
  agency_id: row.agency_id ?? null,
  avg_rating: toNum(row.avg_rating),
  rating_count: Number(row.rating_count ?? 0),
  avg_rating_90d: toNum(row.avg_rating_90d),
  rating_count_90d: Number(row.rating_count_90d ?? 0),
  lifetime_completed: Number(row.lifetime_completed ?? 0),
  lifetime_no_shows: Number(row.lifetime_no_shows ?? 0),
  lifetime_cancelled: Number(row.lifetime_cancelled ?? 0),
  completion_rate: toNum(row.completion_rate),
  on_time_rate: toNum(row.on_time_rate),
  shifts_last_30d: Number(row.shifts_last_30d ?? 0),
  hours_last_30d: Number(row.hours_last_30d ?? 0),
  lifetime_hours: Number(row.lifetime_hours ?? 0),
});

/** Fetches performance rows (RLS-scoped) keyed by caregiver id. */
export async function fetchCaregiverPerformance(
  caregiverIds?: string[]
): Promise<Map<string, CaregiverPerformance>> {
  const map = new Map<string, CaregiverPerformance>();
  if (caregiverIds && caregiverIds.length === 0) return map;

  let query = (supabase.from("caregiver_performance" as never) as any).select("*");
  if (caregiverIds) query = query.in("caregiver_id", caregiverIds);

  const { data, error } = await query;
  if (error) {
    console.error("caregiver_performance fetch failed", error);
    return map;
  }
  (data || []).forEach((row: any) => map.set(row.caregiver_id, normalize(row)));
  return map;
}

export async function fetchOneCaregiverPerformance(
  caregiverId: string
): Promise<CaregiverPerformance | null> {
  const map = await fetchCaregiverPerformance([caregiverId]);
  return map.get(caregiverId) ?? null;
}

/** Honest label — an unrated caregiver is never shown or ranked as 0. */
export const ratingLabel = (perf?: CaregiverPerformance | null) =>
  perf && perf.avg_rating != null
    ? `${perf.avg_rating.toFixed(1)} (${perf.rating_count})`
    : "No ratings yet";

export const shortRatingLabel = (perf?: CaregiverPerformance | null) =>
  perf && perf.avg_rating != null ? `★ ${perf.avg_rating.toFixed(1)} (${perf.rating_count})` : "—";
