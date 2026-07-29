import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import assistantMark from "@/assets/assistant-mark.png";
import { ConversationSurface } from "@/components/chat/ConversationSurface";
import { FamilyIntakeSurface } from "@/components/chat/FamilyIntakeSurface";
import {
  HeartHandshake,
  Brain,
  FileCheck,
  Network,
  ArrowRight,
  Check,
} from "lucide-react";

const valueProps = [
  {
    icon: Brain,
    title: "AI caregiver screening",
    description:
      "Our ICE screening identifies caregivers who stay. Industry average 90-day retention is 35%. Ours is 78%.",
  },
  {
    icon: FileCheck,
    title: "Digital care plans",
    description:
      "From client inquiry to signed care agreement in minutes, not days. No paperwork, no back-and-forth.",
  },
  {
    icon: Network,
    title: "Sub-agency network",
    description:
      "License your brand to home-based care entrepreneurs. Earn passive royalties while they serve more clients under your name.",
  },
];

const steps = [
  {
    number: "01",
    title: "Set up your agency in 15 minutes",
    description:
      "Configure your brand, service area, and care services from a single dashboard.",
  },
  {
    number: "02",
    title: "Let the AI agent handle inquiries",
    description:
      "The conversational assistant greets caregiver applicants and client families 24/7 and captures everything you need.",
  },
  {
    number: "03",
    title: "Review screened applicants instantly",
    description:
      "Every applicant arrives with a Workplace Insights report scored across five dimensions — approve with one click.",
  },
  {
    number: "04",
    title: "Sign care plans and start scheduling",
    description:
      "Turn inquiries into recurring care plans with service lines, then auto-generate and assign shifts.",
  },
  {
    number: "05",
    title: "Grow your network with sub-agencies",
    description:
      "Invite home-based care entrepreneurs to operate under your license and earn royalties as they grow.",
  },
];

const audiences = [
  {
    title: "Established agencies",
    description:
      "Expand your reach with a virtual office. No migration. Run parallel to your existing operation.",
    features: [
      "No disruption to current systems",
      "Sub-agency network",
      "Passive royalties",
      "Analytics across every location",
    ],
    featured: false,
  },
  {
    title: "New care entrepreneurs",
    description:
      "Launch your own home care agency from home. No license required. Operate under a master agency network.",
    features: [
      "Use master agency license",
      "AI screens caregivers for you",
      "Digital contracts out of the box",
      "Keep 85% of revenue",
    ],
    featured: true,
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [agentMode, setAgentMode] = useState<"caregiver" | "family" | null>(null);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-surface-1 text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface-1/90 backdrop-blur">
        <nav className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <a href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand">
              <HeartHandshake className="h-5 w-5 text-brand-foreground" />
            </span>
            <span className="text-xl font-bold tracking-tight">CareMuch</span>
          </a>
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <button onClick={() => scrollTo("who-its-for")} className="hover:text-foreground">
              For agencies
            </button>
            <button onClick={() => scrollTo("who-its-for")} className="hover:text-foreground">
              For founders
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/auth")}>
              Sign in
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              Get started
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-surface-1">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              Pilot live with Kind Care · Chicago
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              The platform that powers home care agencies
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              From AI caregiver screening to digital care plan contracts —
              CareMuch gives agencies and home care entrepreneurs everything
              they need to launch, grow, and scale.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
              >
                Start your free trial
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollTo("how-it-works")}>
                See how it works
              </Button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              No migration required · Run parallel to your existing operation ·
              Cancel any time
            </p>
          </div>
        </div>
      </section>

      {/* AI agent */}
      <section className="bg-surface-2 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              AI agent
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Meet your virtual care coordinator
            </h2>
            <p className="mt-4 text-muted-foreground">
              Our conversational AI guides caregivers and client families
              through the entire process — no forms, no phone calls, no
              back-and-forth. Available 24/7.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-xl">
            <div className="mb-4 flex justify-center gap-2">
              {([
                { key: "caregiver", label: "I want to work as a caregiver" },
                { key: "family", label: "I need care for a loved one" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAgentMode(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    agentMode === tab.key
                      ? "bg-brand text-brand-foreground"
                      : "bg-surface-1 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-lg">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <img
                  src={assistantMark}
                  alt="CareMuch assistant"
                  width={72}
                  height={72}
                  loading="lazy"
                  className="h-9 w-9 rounded-lg object-contain"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">CareMuch assistant</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Powered by ICE screening · Kind Care Services
                  </p>
                </div>
              </div>

              <div className="max-h-[640px] overflow-y-auto">
                {agentMode === "caregiver" && (
                  <ConversationSurface
                    key="caregiver"
                    embedded
                    audience="caregiver_screening"
                    agencyName="Kind Care Services"
                    onExit={() => setAgentMode(null)}
                  />
                )}
                {agentMode === "family" && (
                  <FamilyIntakeSurface
                    key="family"
                    embedded
                    onExit={() => setAgentMode(null)}
                  />
                )}
                {!agentMode && (
                  <div className="flex min-h-[380px] flex-col items-center justify-center gap-5 px-6 py-12 text-center">
                    <p className="max-w-sm text-lg font-semibold leading-snug">
                      Hi, I'm the CareMuch assistant. What brings you here today?
                    </p>
                    <div className="grid w-full max-w-sm gap-2.5">
                      <button
                        onClick={() => setAgentMode("family")}
                        className="rounded-xl border border-border px-4 py-3 text-left text-sm font-medium transition-colors hover:border-brand hover:bg-brand-soft"
                      >
                        I need care for a loved one
                      </button>
                      <button
                        onClick={() => setAgentMode("caregiver")}
                        className="rounded-xl border border-border px-4 py-3 text-left text-sm font-medium transition-colors hover:border-brand hover:bg-brand-soft"
                      >
                        I want to work as a caregiver
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is the live assistant — your answers are saved to the agency dashboard.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Agency managers control every question, answer, and branch — no
              code required
            </p>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="bg-surface-1 py-20 md:py-28">
        <div className="container mx-auto grid gap-8 px-4 md:grid-cols-3">
          {valueProps.map((prop) => (
            <div
              key={prop.title}
              className="rounded-2xl border border-border bg-surface-1 p-6 transition-shadow hover:shadow-lg"
            >
              <span className="mb-5 inline-flex rounded-xl bg-brand-soft p-3">
                <prop.icon className="h-6 w-6 text-brand" />
              </span>
              <h3 className="mb-3 text-xl font-semibold">{prop.title}</h3>
              <p className="leading-relaxed text-muted-foreground">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-surface-2 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How it works</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Everything you need to run a modern home care agency, from first
              setup to a growing network.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex gap-4 rounded-2xl border border-border bg-surface-1 p-6"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-bold text-brand">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section id="who-its-for" className="bg-surface-1 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <h2 className="mb-14 text-center text-3xl font-bold md:text-4xl">
            Who it is for
          </h2>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className={`rounded-2xl bg-surface-1 p-8 transition-shadow hover:shadow-lg ${
                  audience.featured
                    ? "border-[1.5px] border-brand"
                    : "border border-border"
                }`}
              >
                <h3 className="text-2xl font-semibold">{audience.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {audience.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {audience.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilot banner */}
      <section className="bg-surface-1 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto flex max-w-5xl items-start gap-3 rounded-2xl bg-success/10 px-6 py-5">
            <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <p className="text-sm text-foreground">
              Currently in private beta with Kind Care Services · Chicago. We
              are accepting a limited number of additional agency partners for
              our early access program.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface-2 py-20 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Ready to modernize your agency?
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="mailto:munkh.mn@gmail.com?subject=CareMuch demo request">
                Request a demo
              </a>
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Questions? Email us at{" "}
            <a className="text-brand hover:underline" href="mailto:munkh.mn@gmail.com">
              munkh.mn@gmail.com
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface-1 py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground md:flex-row">
          <p>CareMuch © 2026 · Built for home care entrepreneurs</p>
          <a
            href="https://optimal-care-flow.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            View live prototype →
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
