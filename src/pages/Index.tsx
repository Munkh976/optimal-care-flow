import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Sparkles,
  FileText,
  Share2,
  CheckCircle2,
  ArrowRight,
  Building2,
  Rocket,
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const scrollToHowItWorks = () => {
    const el = document.getElementById("how-it-works");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const valueProps = [
    {
      icon: Sparkles,
      title: "AI-Powered Screening",
      description:
        "Our ICE screening identifies caregivers who stay. Industry average 90-day retention is 35%. Ours is 78%.",
    },
    {
      icon: FileText,
      title: "Digital Care Plans",
      description:
        "From client inquiry to signed care agreement in minutes, not days. No paperwork, no back-and-forth.",
    },
    {
      icon: Share2,
      title: "Sub-Agency Network",
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
      title: "Screen and hire caregivers with AI",
      description:
        "Invite candidates, run them through ICE screening, and approve top performers in one place.",
    },
    {
      number: "03",
      title: "Match clients and sign care plans digitally",
      description:
        "Convert inquiries into recurring care plans and assign the best matched caregivers automatically.",
    },
  ];

  const audiences = [
    {
      icon: Building2,
      title: "For established agencies",
      description:
        "Expand your reach with a virtual office. No migration. Run parallel to your existing operation.",
    },
    {
      icon: Rocket,
      title: "For new care entrepreneurs",
      description:
        "Launch your own home care agency from home. No license required. Operate under a master agency network.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-accent/10 via-background to-background">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                <Activity className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                CareMuch
              </span>
            </div>
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign in
            </Button>
          </nav>

          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-foreground">
              The platform that powers home care agencies
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              From caregiver screening to care plan contracts — CareMuch gives
              home care entrepreneurs everything they need to launch, grow, and
              scale.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Start your free trial
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={scrollToHowItWorks}
                className="border-accent text-accent hover:bg-accent/10"
              >
                See how it works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {valueProps.map((prop) => (
              <div
                key={prop.title}
                className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-all duration-300"
              >
                <div className="inline-flex p-3 rounded-xl bg-accent/10 mb-5">
                  <prop.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {prop.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {prop.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              How it works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything you need to run a modern home care agency, from first
              setup to signed care plan.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative p-8 rounded-2xl bg-card border"
              >
                <div className="text-5xl font-bold text-accent/20 mb-6">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who It Is For Section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Who it is for
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className="p-8 rounded-2xl bg-card border hover:shadow-lg transition-all duration-300"
              >
                <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-5">
                  <audience.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 text-card-foreground">
                  {audience.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {audience.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-medium text-foreground">
                Pilot partner: Kind Care Services, Michigan
              </span>
            </div>
            <p className="text-muted-foreground">
              Currently in private beta — limited spots available
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>CareMuch © 2026</p>
            <div className="flex items-center gap-6">
              <a
                href="mailto:munkh.mn@gmail.com"
                className="hover:text-foreground transition-colors"
              >
                munkh.mn@gmail.com
              </a>
              <a
                href="https://caremuch.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                caremuch.io
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
