import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, HeartHandshake, UserRoundPlus } from "lucide-react";
import assistantMark from "@/assets/assistant-mark.png";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ConversationSurface } from "@/components/chat/ConversationSurface";

type Audience = "caregiver_screening" | "family_intake";

export default function Assistant() {
  const [audience, setAudience] = useState<Audience | null>(null);

  if (audience === "caregiver_screening") {
    return (
      <ConversationSurface
        audience="caregiver_screening"
        completionTitle="Thanks for sharing"
        completionMessage="Finish your application and a manager will review it with your answers attached."
        actionLabel="Continue to application"
        onAction={() => (window.location.href = "/caregiver-registration")}
        onExit={() => setAudience(null)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Home
            </Link>
          </Button>
          {audience && (
            <Button variant="ghost" size="sm" onClick={() => setAudience(null)}>
              Change topic
            </Button>
          )}
        </div>

        {!audience ? (
          <Card className="overflow-hidden shadow-lg">
            <CardContent className="space-y-6 p-6 text-center">
              <img
                src={assistantMark}
                alt="CareMuch assistant"
                width={512}
                height={512}
                className="mx-auto h-16 w-16 object-contain"
              />
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold text-foreground">
                  Welcome to CareMuch
                </h1>
                <p className="text-sm text-muted-foreground">
                  A few guided questions — just tap the answer that fits best. What brings
                  you here today?
                </p>
              </div>

              <div className="grid gap-3 text-left">
                <button
                  type="button"
                  onClick={() => setAudience("family_intake")}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-accent"
                >
                  <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      I need care for a loved one
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Tell us about your needs and we'll match the right caregiver.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAudience("caregiver_screening")}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-accent"
                >
                  <UserRoundPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      I want to work as a caregiver
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Answer a short screening, then finish your application.
                    </span>
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ChatWidget
            audience="family_intake"
            title="Care needs intake"
            subtitle="About 8 quick questions"
            completionTitle="Thank you!"
            completionMessage="Our care team has your details and will reach out to arrange a consultation."
          />
        )}
      </div>
    </main>
  );
}