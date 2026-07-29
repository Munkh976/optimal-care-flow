import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AnswerInput, FlowAnswer, FlowNode } from "@/lib/flowEngine";
import { useConversationFlow } from "@/hooks/useConversationFlow";
import { buildSections, locateNode } from "@/lib/conversationSections";
import { AnswerPill } from "./AnswerPill";
import { SectionProgress } from "./SectionProgress";
import { ResultRegistration } from "./ResultRegistration";
import { DynamicQuestion } from "./DynamicQuestion";
import { isDynamicSource } from "@/lib/dynamicCatalog";

export interface ConversationSurfaceProps {
  audience: "caregiver_screening" | "family_intake" | "general";
  agencyName?: string;
  onExit?: () => void;
}

function summarise(answer: FlowAnswer): string {
  if (answer.skipped && answer.optionLabels.length === 0 && !answer.freeText) return "Skipped";
  const labels = answer.optionLabels;
  if (labels.length > 2) return `${labels[0]} and ${labels.length - 1} more`;
  if (labels.length > 0) return labels.join(", ");
  const text = answer.freeText ?? "";
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

export function ConversationSurface({
  audience,
  agencyName = "our care team",
  onExit,
}: ConversationSurfaceProps) {
  const [stage, setStage] = useState<"welcome" | "name" | "flow">("welcome");
  const [firstName, setFirstName] = useState("");
  const [nameDraft, setNameDraft] = useState("");

  const flowState = useConversationFlow(audience);
  const { flow, state, currentNode, loading, error, saving, score } = flowState;
  const [completed, setCompleted] = useState(false);
  const [typing, setTyping] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const finishedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sections = useMemo(() => (flow ? buildSections(flow) : []), [flow]);
  const nodesById = useMemo(
    () => Object.fromEntries((flow?.nodes ?? []).map((n) => [n.id, n])),
    [flow]
  );

  const located = locateNode(sections, state?.currentNodeId ?? null);
  const activeSection = located?.section ?? sections[sections.length - 1] ?? null;
  const completedInSection = located ? located.indexInSection : activeSection?.nodes.length ?? 0;

  const isFinished = Boolean(state && !state.currentNodeId && state.answers.length > 0);

  // Reset the pending selection whenever the question changes.
  useEffect(() => {
    setSelected([]);
    setFreeText("");
  }, [currentNode?.id]);

  useEffect(() => {
    if (!isFinished || finishedRef.current || loading || !flow) return;
    finishedRef.current = true;
    (async () => {
      await flowState.complete({ name: firstName || undefined });
      setCompleted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, loading, flow]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state?.answers.length, typing, completed, stage]);

  const submit = async (input: AnswerInput) => {
    setTyping(true);
    await flowState.answer(input);
    window.setTimeout(() => setTyping(false), 400);
  };

  const transcript = state?.answers ?? [];

  if (stage === "welcome") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-convo-surface px-6 text-center">
        <h1 className="max-w-md text-2xl font-bold leading-snug text-convo-ink">
          Hi, I'm CareMuch. Let's see if {agencyName} is a great fit for you.
        </h1>
        <p className="mt-3 text-sm text-convo-muted">This takes about 3 minutes.</p>
        <button
          type="button"
          onClick={() => setStage("name")}
          className="mt-8 w-full max-w-sm rounded-2xl bg-convo-accent px-4 py-3.5 text-sm font-bold text-convo-accent-foreground"
        >
          Let's get started
        </button>
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="mt-4 text-sm text-convo-muted underline-offset-4 hover:underline"
          >
            Not now
          </button>
        )}
      </div>
    );
  }

  if (stage === "name") {
    return (
      <div className="flex min-h-screen flex-col bg-convo-surface px-6 pt-16">
        <button
          type="button"
          onClick={() => setStage("welcome")}
          aria-label="Go back"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-convo-muted hover:text-convo-ink"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <form
          className="mx-auto w-full max-w-lg"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nameDraft.trim()) return;
            setFirstName(nameDraft.trim());
            setStage("flow");
          }}
        >
          <p className="text-[19px] font-bold leading-snug text-convo-ink">
            What's your first name?
          </p>
          <p className="pt-2 text-sm text-convo-muted">So I know what to call you.</p>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="First name"
            aria-label="First name"
            className="mt-5 w-full rounded-2xl border border-convo-line bg-convo-surface px-4 py-3.5 text-sm text-convo-ink outline-none focus:border-convo-accent"
          />
          <button
            type="submit"
            disabled={!nameDraft.trim()}
            className="mt-3 w-full rounded-2xl bg-convo-accent px-4 py-3.5 text-sm font-bold text-convo-accent-foreground disabled:opacity-50"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  const multi = currentNode?.node_type === "multi_select";
  const needsText = Boolean(currentNode?.allow_free_text && currentNode.options.length === 0);
  const canContinue = needsText ? freeText.trim().length > 0 : selected.length > 0;
  // Avoid printing "Select all that apply." twice when a manager also typed it
  // into the helper text of a multi-select question.
  const helperRepeatsMultiHint =
    multi && /select all that apply/i.test(currentNode?.helper_text ?? "");

  // Every catalog item the visitor picked, used to record the care services
  // they can provide on the application itself.
  const pickedCatalogIds = transcript.flatMap((a) => a.dynamicItemIds ?? []);

  return (
    <div className="flex min-h-screen flex-col bg-convo-surface">
      <header className="relative flex flex-col items-center border-b border-convo-line px-4 pt-3">
        <button
          type="button"
          onClick={() => (transcript.length > 0 ? flowState.back() : setStage("name"))}
          aria-label="Go back"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-convo-muted transition-colors hover:text-convo-ink"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {activeSection && !completed && (
          <SectionProgress
            title={activeSection.title}
            total={activeSection.nodes.length}
            completed={completedInSection}
          />
        )}
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 pb-16">
        {loading && (
          <div className="flex items-center justify-center py-16 text-convo-muted">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading...
          </div>
        )}

        {!loading && error && (
          <p className="px-6 py-12 text-center text-sm text-convo-muted">{error}</p>
        )}

        {!loading && !error && (
          <>
            {transcript.length === 0 && !completed && (
              <p className="px-6 pt-6 text-sm text-convo-muted">
                Nice to meet you {firstName}! Let's find out if this is a good fit.
              </p>
            )}

            {transcript.map((answer) => {
              const node = nodesById[answer.nodeId] as FlowNode | undefined;
              return (
                <div key={`${answer.nodeId}-${answer.sequenceIndex}`}>
                  <p className="px-6 pt-6 text-[19px] font-bold leading-snug text-convo-ink">
                    {node?.prompt}
                  </p>
                  <AnswerPill
                    text={summarise(answer)}
                    onEdit={() => flowState.rewindTo(answer.nodeId)}
                  />
                </div>
              );
            })}

            {typing && (
              <div className="flex items-center gap-1.5 px-6 py-6">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    style={{ animationDelay: `${delay}ms` }}
                    className="h-2 w-2 animate-bounce rounded-full bg-convo-line"
                  />
                ))}
              </div>
            )}

            {!completed && !typing && currentNode && isDynamicSource(currentNode.dynamic_source_table) && (
              <DynamicQuestion
                key={currentNode.id}
                node={currentNode}
                saving={saving}
                onSubmit={submit}
              />
            )}

            {!completed && !typing && currentNode && !isDynamicSource(currentNode.dynamic_source_table) && (
              <div className="animate-fade-in pb-8">
                <p className="px-6 pt-6 text-[19px] font-bold leading-snug text-convo-ink">
                  {currentNode.prompt}
                </p>
                {currentNode.helper_text && !helperRepeatsMultiHint && (
                  <p className="px-6 pt-2 text-sm text-convo-muted">{currentNode.helper_text}</p>
                )}
                {multi && (
                  <p className="px-6 pt-2 text-sm text-convo-muted">Select all that apply.</p>
                )}

                <div className="space-y-2.5 px-6 pt-5">
                  {needsText ? (
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      rows={4}
                      placeholder={currentNode.free_text_label || "Type your answer"}
                      aria-label="Your answer"
                      className="w-full rounded-2xl border border-convo-line bg-convo-surface px-4 py-3 text-sm text-convo-ink outline-none focus:border-convo-accent"
                    />
                  ) : (
                    currentNode.options.map((option) => {
                      const active = selected.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            if (multi) {
                              setSelected((current) =>
                                current.includes(option.id)
                                  ? current.filter((id) => id !== option.id)
                                  : [...current, option.id]
                              );
                            } else {
                              submit({ optionIds: [option.id] });
                            }
                          }}
                          className={`w-full rounded-2xl border px-4 py-3.5 text-center text-sm font-bold transition-colors disabled:opacity-50 ${
                            active
                              ? "border-convo-accent bg-convo-accent/10 text-convo-ink"
                              : "border-convo-line bg-convo-surface text-convo-ink hover:border-convo-accent"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })
                  )}

                  {currentNode.allow_free_text && currentNode.options.length > 0 && (
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      rows={3}
                      placeholder={currentNode.free_text_label || "Anything else to add? (optional)"}
                      aria-label="Additional details"
                      className="w-full rounded-2xl border border-convo-line bg-convo-surface px-4 py-3 text-sm text-convo-ink outline-none focus:border-convo-accent"
                    />
                  )}

                  {(multi || needsText) && (
                    <button
                      type="button"
                      disabled={saving || !canContinue}
                      onClick={() =>
                        submit({
                          optionIds: selected,
                          freeText: freeText.trim() ? freeText.trim() : null,
                        })
                      }
                      className="w-full rounded-2xl bg-convo-accent px-4 py-3.5 text-sm font-bold text-convo-accent-foreground disabled:opacity-50"
                    >
                      Continue
                    </button>
                  )}

                  {currentNode.allow_skip && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => submit({ skipped: true })}
                      className="block w-full pt-2 text-center text-sm text-convo-muted underline-offset-4 hover:underline"
                    >
                      Skip this question →
                    </button>
                  )}
                </div>
              </div>
            )}

            {completed && (
              <div className="px-6 pt-8">
                <ResultRegistration
                  firstName={firstName}
                  agencyName={agencyName}
                  score={score}
                  careServiceItemIds={pickedCatalogIds}
                  onExit={onExit}
                  onRegistered={flowState.linkRegistration}
                />
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </main>
    </div>
  );
}
