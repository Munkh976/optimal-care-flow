import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AnswerInput, FlowAnswer, FlowNode } from "@/lib/flowEngine";
import { useConversationFlow } from "@/hooks/useConversationFlow";
import { buildSections, locateNode } from "@/lib/conversationSections";
import { AnswerPill } from "./AnswerPill";
import { AnswerSheet } from "./AnswerSheet";
import { SectionProgress } from "./SectionProgress";
import { CompletionCard } from "./CompletionCard";

export interface ConversationSurfaceProps {
  audience: "caregiver_screening" | "family_intake" | "general";
  completionTitle?: string;
  completionMessage?: string;
  showScore?: boolean;
  onComplete?: (payload: {
    sessionId: string | null;
    score: ReturnType<typeof import("@/lib/flowEngine").computeScore> | null;
    linkRegistration: (registrationId: string) => Promise<void>;
  }) => void;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  onExit?: () => void;
}

/** Inline buttons for short single-select lists, a bottom sheet for everything else. */
function usesSheet(node: FlowNode): boolean {
  if (node.node_type === "multi_select") return true;
  if (node.options.length === 0) return true;
  if (node.allow_free_text) return true;
  return node.options.length > 4;
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
  completionTitle = "All done — thank you!",
  completionMessage = "Our team will review your answers and be in touch shortly.",
  showScore,
  onComplete,
  actionLabel,
  onAction,
  busy,
  onExit,
}: ConversationSurfaceProps) {
  const flowState = useConversationFlow(audience);
  const { flow, state, currentNode, loading, error, saving, score } = flowState;
  const [completed, setCompleted] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const finishedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sections = useMemo(() => (flow ? buildSections(flow) : []), [flow]);
  const nodesById = useMemo(
    () => Object.fromEntries((flow?.nodes ?? []).map((n) => [n.id, n])),
    [flow]
  );

  const located = locateNode(sections, state?.currentNodeId ?? null);
  const activeSection = located?.section ?? sections[sections.length - 1] ?? null;
  const completedInSection = located
    ? located.indexInSection
    : activeSection?.nodes.length ?? 0;

  const isFinished = Boolean(state && !state.currentNodeId && state.answers.length > 0);

  useEffect(() => {
    if (!isFinished || finishedRef.current || loading || !flow) return;
    finishedRef.current = true;
    (async () => {
      const finalScore = await flowState.complete();
      setCompleted(true);
      onComplete?.({
        sessionId: flowState.sessionId,
        score: finalScore,
        linkRegistration: flowState.linkRegistration,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, loading, flow]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state?.answers.length, typing, completed]);

  const submit = async (input: AnswerInput) => {
    setTyping(true);
    await flowState.answer(input);
    window.setTimeout(() => setTyping(false), 400);
  };

  const transcript = state?.answers ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-convo-surface">
      <header className="relative flex flex-col items-center border-b border-convo-line px-4 pt-3">
        <button
          type="button"
          onClick={() => (transcript.length > 0 ? flowState.back() : onExit?.())}
          disabled={transcript.length === 0 && !onExit}
          aria-label="Go back"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-convo-muted transition-colors hover:text-convo-ink disabled:opacity-0"
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

            {!completed && !typing && currentNode && (
              <div className="animate-fade-in pb-8">
                <p className="px-6 pt-6 text-[19px] font-bold leading-snug text-convo-ink">
                  {currentNode.prompt}
                </p>
                {currentNode.helper_text && (
                  <p className="px-6 pt-2 text-sm text-convo-muted">{currentNode.helper_text}</p>
                )}

                <div className="space-y-2.5 px-6 pt-5">
                  {usesSheet(currentNode) ? (
                    <button
                      type="button"
                      onClick={() => setSheetOpen(true)}
                      disabled={saving}
                      className="w-full rounded-2xl bg-convo-accent px-4 py-3.5 text-sm font-bold text-convo-accent-foreground transition-opacity disabled:opacity-50"
                    >
                      Answer
                    </button>
                  ) : (
                    currentNode.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={saving}
                        onClick={() => submit({ optionIds: [option.id] })}
                        className="w-full rounded-2xl border border-convo-line bg-convo-surface px-4 py-3.5 text-center text-sm font-bold text-convo-ink transition-colors hover:border-convo-accent disabled:opacity-50"
                      >
                        {option.label}
                      </button>
                    ))
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
                <CompletionCard
                  title={completionTitle}
                  message={completionMessage}
                  score={score}
                  showScore={showScore}
                  onRestart={flowState.restart}
                  actionLabel={actionLabel}
                  onAction={onAction}
                  busy={busy}
                />
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </main>

      <AnswerSheet
        node={currentNode}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmit={(input) => submit(input)}
      />
    </div>
  );
}