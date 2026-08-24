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
}

/** Display-only. No engine reads this value. */
export const FlexibilityBadge = ({ value, className }: FlexibilityBadgeProps) => {
  if (!value) return null;
  const key = String(value).toLowerCase();
  return (
    <Badge variant="secondary" className={className}>
      Flexibility: {LABELS[key] ?? value}
    </Badge>
  );
};
