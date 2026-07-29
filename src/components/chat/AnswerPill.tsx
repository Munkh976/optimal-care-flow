import { Pencil } from "lucide-react";

interface AnswerPillProps {
  text: string;
  onEdit?: () => void;
}

export function AnswerPill({ text, onEdit }: AnswerPillProps) {
  return (
    <div className="animate-fade-in flex items-center justify-end gap-2 px-6 pb-6 pt-2">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Change this answer"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-convo-line bg-convo-surface text-convo-muted transition-colors hover:text-convo-ink"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="max-w-[80%] truncate rounded-full bg-convo-pill px-4 py-2 text-sm font-medium text-convo-pill-foreground">
        {text}
      </span>
    </div>
  );
}