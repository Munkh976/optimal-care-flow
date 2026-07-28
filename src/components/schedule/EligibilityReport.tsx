import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { EligibilityResult } from "@/lib/shiftEligibility";

export function EligibilityReport({ result }: { result: EligibilityResult }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {result.autoApprovable ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="font-medium text-success">All checks passed — no manager approval needed</span>
          </>
        ) : result.eligible ? (
          <>
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="font-medium text-warning">Allowed, but needs manager approval</span>
          </>
        ) : (
          <>
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <span className="font-medium text-destructive">Blocked</span>
          </>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Week hours: {result.weeklyHours}h → <span className="font-medium">{result.projectedWeeklyHours}h</span>
      </div>

      {result.blockers.length > 0 && (
        <div className="space-y-1">
          {result.blockers.map((b) => (
            <div key={b.code} className="rounded border border-destructive/30 bg-destructive/5 p-2">
              <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
                {b.label}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{b.detail}</p>
            </div>
          ))}
        </div>
      )}

      {result.flags.length > 0 && (
        <div className="space-y-1">
          {result.flags.map((f) => (
            <div key={f.code} className="rounded border border-warning/30 bg-warning/5 p-2">
              <div className="flex items-center gap-2 text-xs font-medium text-warning">
                <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Review</Badge>
                {f.label}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{f.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}