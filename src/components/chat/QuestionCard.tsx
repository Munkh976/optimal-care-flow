import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import { FlowNode } from "@/lib/flowEngine";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  node: FlowNode;
  disabled?: boolean;
  onAnswer: (input: { optionIds: string[]; freeText?: string | null }) => void;
}

export function QuestionCard({ node, disabled, onAnswer }: QuestionCardProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");

  useEffect(() => {
    setSelected([]);
    setFreeText("");
  }, [node.id]);

  const multi = node.node_type === "multi_select";

  const choose = (id: string) => {
    if (disabled) return;
    if (multi) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      return;
    }
    setSelected([id]);
    onAnswer({ optionIds: [id], freeText: freeText.trim() || null });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold leading-snug text-foreground">{node.prompt}</h2>
        {node.helper_text && (
          <p className="text-sm text-muted-foreground">{node.helper_text}</p>
        )}
      </div>

      {node.node_type !== "info" && (
        <div className="grid gap-2.5">
          {node.options.map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => choose(option.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors",
                  "hover:border-primary hover:bg-accent disabled:opacity-60",
                  active ? "border-primary bg-accent" : "border-border bg-card"
                )}
              >
                <span>{option.label}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      {node.allow_free_text && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {node.free_text_label || "Anything you'd like to add? (optional)"}
          </label>
          <Textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={3}
            placeholder="Type your answer..."
            disabled={disabled}
          />
        </div>
      )}

      {(multi || node.node_type === "info" || (node.allow_free_text && node.options.length === 0)) && (
        <Button
          className="w-full"
          disabled={disabled || (multi && selected.length === 0)}
          onClick={() => onAnswer({ optionIds: selected, freeText: freeText.trim() || null })}
        >
          Continue
        </Button>
      )}
    </div>
  );
}