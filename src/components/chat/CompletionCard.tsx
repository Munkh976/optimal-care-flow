import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { BAND_LABELS, ScoreResult } from "@/lib/flowEngine";

interface CompletionCardProps {
  title: string;
  message: string;
  score?: ScoreResult | null;
  showScore?: boolean;
  onRestart?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}

export function CompletionCard({
  title,
  message,
  score,
  showScore,
  onRestart,
  actionLabel,
  onAction,
  busy,
}: CompletionCardProps) {
  return (
    <div className="space-y-5 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>

      {showScore && score && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-left">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Screening result</span>
            <Badge variant={score.band === "strong_fit" ? "default" : "secondary"}>
              {BAND_LABELS[score.band]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {score.percent}% match across {Object.keys(score.traits).length || 0} traits
          </p>
        </div>
      )}

      <div className="space-y-2">
        {actionLabel && onAction && (
          <Button className="w-full" onClick={onAction} disabled={busy}>
            {busy ? "Submitting..." : actionLabel}
          </Button>
        )}
        {onRestart && (
          <Button variant="ghost" className="w-full" onClick={onRestart}>
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}