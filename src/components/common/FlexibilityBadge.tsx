import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, string> = {
  continuity: "Continuity first",
  strict: "Continuity first",
  balanced: "Balanced",
  moderate: "Balanced",
  flexible: "Flexible",
};

interface FlexibilityBadgeProps {
  value?: string | null;
  className?: string;
  /** Render a muted "not set" badge instead of nothing when value is null. */
  showUnset?: boolean;
}

/** Display-only. No engine reads this value. */
export const FlexibilityBadge = ({ value, className, showUnset }: FlexibilityBadgeProps) => {
  if (!value) {
    if (!showUnset) return null;
    return (
      <Badge variant="outline" className={className}>
        Flexibility: not set
      </Badge>
    );
  }
  const key = String(value).toLowerCase();
  return (
    <Badge variant="secondary" className={className}>
      Flexibility: {LABELS[key] ?? value}
    </Badge>
  );
};

