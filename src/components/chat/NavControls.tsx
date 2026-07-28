import { Button } from "@/components/ui/button";
import { ArrowLeft, SkipForward } from "lucide-react";

interface NavControlsProps {
  canGoBack: boolean;
  canSkip: boolean;
  disabled?: boolean;
  onBack: () => void;
  onSkip: () => void;
}

export function NavControls({ canGoBack, canSkip, disabled, onBack, onSkip }: NavControlsProps) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button variant="ghost" size="sm" onClick={onBack} disabled={!canGoBack || disabled}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back
      </Button>
      {canSkip && (
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={disabled}>
          Skip
          <SkipForward className="ml-1.5 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}