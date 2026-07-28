import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import assistantMark from "@/assets/assistant-mark.png";
import { useConversationFlow } from "@/hooks/useConversationFlow";
import { canGoBack } from "@/lib/flowEngine";
import { QuestionCard } from "./QuestionCard";
import { NavControls } from "./NavControls";
import { CompletionCard } from "./CompletionCard";

export interface ChatWidgetProps {
  audience: "caregiver_screening" | "family_intake" | "general";
  title?: string;
  subtitle?: string;
  completionTitle?: string;
  completionMessage?: string;
  showScore?: boolean;
  onComplete?: (payload: {
    sessionId: string | null;
    score: ReturnType<typeof import("@/lib/flowEngine").computeScore> | null;
  }) => void;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}

export function ChatWidget({
  audience,
  title = "CareMuch Assistant",
  subtitle,
  completionTitle = "All done — thank you!",
  completionMessage = "Our team will review your answers and be in touch shortly.",
  showScore,
  onComplete,
  actionLabel,
  onAction,
  busy,
}: ChatWidgetProps) {
  const flowState = useConversationFlow(audience);
  const [completed, setCompleted] = useState(false);
  const finishedRef = useRef(false);
  const { flow, state, currentNode, loading, error, saving, progress, score } = flowState;
  const isFinished = Boolean(state && !state.currentNodeId && state.answers.length > 0);

  useEffect(() => {
    if (!isFinished || finishedRef.current || loading || !flow) return;
    finishedRef.current = true;
    (async () => {
      const finalScore = await flowState.complete();
      setCompleted(true);
      onComplete?.({ sessionId: flowState.sessionId, score: finalScore });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, loading, flow]);

  const handleAnswer = async (input: { optionIds: string[]; freeText?: string | null }) => {
    await flowState.answer(input);
  };

  const handleSkip = async () => {
    await flowState.answer({ skipped: true });
  };

  return (
    <Card className="mx-auto w-full max-w-lg overflow-hidden shadow-lg">
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <img
          src={assistantMark}
          alt="CareMuch assistant"
          width={512}
          height={512}
          loading="lazy"
          className="h-9 w-9 rounded-lg object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {subtitle || flow?.description || "A few quick questions"}
          </p>
        </div>
        {!completed && progress.total > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground">
            Step {progress.step} of {progress.total}
          </span>
        )}
      </div>

      {!completed && progress.total > 0 && (
        <Progress value={progress.percent} className="h-1 rounded-none" />
      )}

      <CardContent className="p-5">
        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading...
          </div>
        )}

        {!loading && error && (
          <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
        )}

        {!loading && !error && !completed && currentNode && state && (
          <div className="space-y-2">
            <QuestionCard node={currentNode} disabled={saving} onAnswer={handleAnswer} />
            <NavControls
              canGoBack={canGoBack(state)}
              canSkip={currentNode.allow_skip}
              disabled={saving}
              onBack={flowState.back}
              onSkip={handleSkip}
            />
          </div>
        )}

        {!loading && !error && completed && (
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
        )}
      </CardContent>
    </Card>
  );
}