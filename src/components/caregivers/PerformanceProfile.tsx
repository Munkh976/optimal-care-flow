import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import type { CaregiverPerformance } from "@/lib/caregiverPerformance";

/**
 * Transparent performance profile: shows the computed pieces, not one opaque
 * score. Everything here is derived from shift_ratings + shift_assignments.
 */
export const PerformanceProfile = ({
  perf,
  compact = false,
}: {
  perf: CaregiverPerformance | null;
  compact?: boolean;
}) => {
  const metric = (label: string, value: string, hint?: string) => (
    <div key={label} className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );

  const hasReliabilityData =
    !!perf && perf.lifetime_completed + perf.lifetime_no_shows + perf.lifetime_cancelled > 0;

  const body = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Star
          className={`h-5 w-5 ${
            perf?.avg_rating != null ? "fill-warning text-warning" : "text-muted-foreground/40"
          }`}
        />
        {perf?.avg_rating != null ? (
          <>
            <span className="text-2xl font-bold">{perf.avg_rating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">
              from {perf.rating_count} rated shift{perf.rating_count === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <Badge variant="outline">No ratings yet</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metric(
          "Recent rating (90d)",
          perf?.avg_rating_90d != null ? perf.avg_rating_90d.toFixed(1) : "—",
          perf?.rating_count_90d
            ? `${perf.rating_count_90d} rating${perf.rating_count_90d === 1 ? "" : "s"}`
            : "No ratings in the last 90 days"
        )}
        {metric(
          "Completion rate",
          hasReliabilityData && perf?.completion_rate != null
            ? `${perf.completion_rate}%`
            : "Not enough data",
          hasReliabilityData
            ? `${perf!.lifetime_completed} completed · ${perf!.lifetime_no_shows} no-show · ${perf!.lifetime_cancelled} cancelled`
            : "No completed / no-show / cancelled shifts recorded yet"
        )}
        {metric(
          "On-time clock-in",
          perf?.on_time_rate != null ? `${perf.on_time_rate}%` : "Not enough data",
          "Within 5 minutes of shift start"
        )}
        {metric(
          "Last 30 days",
          `${perf?.shifts_last_30d ?? 0} shifts`,
          `${Number(perf?.hours_last_30d ?? 0)}h worked`
        )}
        {metric("Lifetime hours", `${Number(perf?.lifetime_hours ?? 0)}h`)}
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Performance</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
};
