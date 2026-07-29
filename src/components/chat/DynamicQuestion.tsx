import { useEffect, useMemo, useState } from "react";
import { AnswerInput, FlowNode } from "@/lib/flowEngine";
import {
  DynamicItem,
  accumulateWeights,
  fetchDynamicItems,
  renderSubQuestion,
} from "@/lib/dynamicCatalog";

interface DynamicQuestionProps {
  node: FlowNode;
  saving?: boolean;
  onSubmit: (input: AnswerInput) => void;
}

/**
 * A question whose answers come from a catalog table.
 *
 * For care service categories the visitor first picks categories, then answers
 * one follow-up per chosen category listing the services inside it. Everything
 * is recorded as a single answer for the node once the last step is confirmed.
 */
export function DynamicQuestion({ node, saving, onSubmit }: DynamicQuestionProps) {
  const source = node.dynamic_source_table as string;
  const isCategories = source === "care_service_categories";

  const [items, setItems] = useState<DynamicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<DynamicItem[]>([]);
  const [step, setStep] = useState(0); // 0 = main question, 1..n = per-category follow-ups
  const [subItems, setSubItems] = useState<DynamicItem[]>([]);
  const [subPicked, setSubPicked] = useState<DynamicItem[]>([]);
  const [subAnswers, setSubAnswers] = useState<DynamicItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPicked([]);
    setStep(0);
    setSubAnswers([]);
    fetchDynamicItems(source)
      .then((rows) => !cancelled && setItems(rows))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, node.id]);

  const activeCategory = step > 0 ? picked[step - 1] : null;

  useEffect(() => {
    if (!activeCategory) return;
    let cancelled = false;
    setLoading(true);
    setSubPicked([]);
    fetchDynamicItems("care_types", { categoryId: activeCategory.id })
      .then((rows) => !cancelled && setSubItems(rows))
      .catch(() => !cancelled && setSubItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeCategory?.id]);

  const prompt = activeCategory
    ? renderSubQuestion(node.sub_question_template, activeCategory.name)
    : node.prompt;
  const visible = activeCategory ? subItems : items;
  const chosen = activeCategory ? subPicked : picked;

  const toggle = (item: DynamicItem) => {
    const set = activeCategory ? setSubPicked : setPicked;
    set((current) =>
      current.some((i) => i.id === item.id)
        ? current.filter((i) => i.id !== item.id)
        : [...current, item]
    );
  };

  const finish = (allSubAnswers: DynamicItem[]) => {
    const selected = [...picked, ...allSubAnswers];
    onSubmit({
      labels: selected.map((i) => i.name),
      dynamicItemIds: selected.map((i) => i.id),
      traitDeltas: accumulateWeights(node.default_weights, selected),
    });
  };

  const advance = () => {
    if (!activeCategory) {
      if (isCategories && picked.length > 0) {
        setStep(1);
        return;
      }
      finish([]);
      return;
    }
    const merged = [...subAnswers, ...subPicked];
    setSubAnswers(merged);
    if (step < picked.length) {
      setStep(step + 1);
      return;
    }
    finish(merged);
  };

  const total = useMemo(() => (isCategories ? picked.length + 1 : 1), [isCategories, picked.length]);

  // The "Select all that apply." line is rendered by the surface itself, so a
  // helper text that repeats it must not be shown twice.
  const helperSaysSelectAll = /select all that apply/i.test(node.helper_text ?? "");

  return (
    <div className="animate-fade-in pb-8">
      <p className="px-6 pt-6 text-[19px] font-bold leading-snug text-convo-ink">{prompt}</p>
      {!activeCategory && node.helper_text && !helperSaysSelectAll && (
        <p className="px-6 pt-2 text-sm text-convo-muted">{node.helper_text}</p>
      )}
      <p className="px-6 pt-2 text-sm text-convo-muted">
        Select all that apply.
        {total > 1 && ` (${step + 1} of ${total})`}
      </p>

      <div className="space-y-2.5 px-6 pt-5">
        {loading && <p className="text-sm text-convo-muted">Loading options...</p>}
        {!loading && visible.length === 0 && (
          <p className="text-sm text-convo-muted">Nothing to choose here.</p>
        )}
        {visible.map((item) => {
          const active = chosen.some((i) => i.id === item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={saving}
              onClick={() => toggle(item)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-bold transition-colors disabled:opacity-50 ${
                active
                  ? "border-convo-accent bg-convo-accent/10 text-convo-ink"
                  : "border-convo-line bg-convo-surface text-convo-ink hover:border-convo-accent"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                  active
                    ? "border-convo-accent bg-convo-accent text-convo-accent-foreground"
                    : "border-convo-line"
                }`}
              >
                {active ? "✓" : ""}
              </span>
              {item.name}
            </button>
          );
        })}

        <button
          type="button"
          disabled={saving || loading || chosen.length === 0}
          onClick={advance}
          className="w-full rounded-2xl bg-convo-accent px-4 py-3.5 text-sm font-bold text-convo-accent-foreground disabled:opacity-50"
        >
          Continue
        </button>

        {node.allow_skip && (
          <button
            type="button"
            disabled={saving}
            onClick={() => (activeCategory ? advance() : onSubmit({ skipped: true }))}
            className="block w-full pt-2 text-center text-sm text-convo-muted underline-offset-4 hover:underline"
          >
            Skip this question →
          </button>
        )}
      </div>
    </div>
  );
}
