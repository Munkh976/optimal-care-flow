import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import { FlowNode } from "@/lib/flowEngine";

interface AnswerSheetProps {
  node: FlowNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { optionIds: string[]; freeText?: string | null }) => void;
}

export function AnswerSheet({ node, open, onOpenChange, onSubmit }: AnswerSheetProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) {
      setSelected([]);
      setText("");
    }
  }, [open, node?.id]);

  if (!node) return null;

  const multi = node.node_type === "multi_select";
  const freeTextOnly = node.options.length === 0 && node.allow_free_text;
  const canContinue = freeTextOnly ? text.trim().length > 0 : selected.length > 0;

  const toggle = (id: string) => {
    setSelected((current) => {
      if (multi) {
        return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      }
      return [id];
    });
  };

  const handleContinue = () => {
    if (!canContinue) return;
    onSubmit({
      optionIds: selected,
      freeText: node.allow_free_text && text.trim() ? text.trim() : null,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-convo-line bg-convo-surface p-0"
      >
        <div className="flex justify-center pb-2 pt-3">
          <span className="h-1.5 w-10 rounded-full bg-convo-line" />
        </div>
        <div className="space-y-4 px-6 pb-28 pt-2">
          <SheetTitle className="text-lg font-bold leading-snug text-convo-ink">
            {node.prompt}
          </SheetTitle>
          <SheetDescription className={node.helper_text ? "text-sm text-convo-muted" : "sr-only"}>
            {node.helper_text || "Choose your answer, then continue."}
          </SheetDescription>

          {node.options.length > 0 && (
            <div className="space-y-2">
              {node.options.map((option) => {
                const active = selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggle(option.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-colors ${
                      active
                        ? "border-convo-accent bg-convo-accent/5 text-convo-ink"
                        : "border-convo-line bg-convo-surface text-convo-ink hover:border-convo-muted/40"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        active
                          ? "border-convo-accent bg-convo-accent text-convo-accent-foreground"
                          : "border-convo-line"
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}

          {node.allow_free_text && (
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={node.free_text_label || "Type your answer..."}
              rows={5}
              className="resize-none rounded-2xl border-convo-line bg-convo-surface text-convo-ink placeholder:text-convo-muted"
            />
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-convo-line bg-convo-surface px-6 py-4">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full rounded-2xl bg-convo-accent px-4 py-3.5 text-sm font-bold text-convo-accent-foreground transition-opacity disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}