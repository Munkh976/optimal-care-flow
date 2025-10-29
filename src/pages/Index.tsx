import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, Users, Calendar, TrendingUp, Sparkles, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered Matching",
      description: "85%+ matching accuracy with ML-driven caregiver-client pairing",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "90% reduction in scheduling time with automated optimization",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Users,
      title: "Workforce Management",
      description: "25% decrease in caregiver turnover with intelligent workload distribution",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: TrendingUp,
      title: "Real-Time Analytics",
      description: "95% shift fill rates with predictive staffing insights",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              CareMuch
            </span>
          </div>
          <Button onClick={() => navigate("/auth")}>Get Started</Button>
        </nav>

        <div className="max-w-4xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            <span>Intelligent Healthcare Workforce Scheduling</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Transform Healthcare Scheduling with{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              AI Optimization
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            CareMuch employs machine learning to achieve 85%+ matching accuracy, reducing scheduling time from hours
            to seconds while optimizing caregiver-client relationships.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              View Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`inline-flex p-3 rounded-lg ${feature.bgColor} mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="max-w-4xl mx-auto">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/10 to-success/10 border border-primary/20">
            <h2 className="text-2xl font-bold text-center mb-8">Proven Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">90%</div>
                <div className="text-sm text-muted-foreground">Time Saved</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-accent mb-2">85%+</div>
                <div className="text-sm text-muted-foreground">Match Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-success mb-2">25%</div>
                <div className="text-sm text-muted-foreground">Turnover Reduction</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-warning mb-2">95%</div>
                <div className="text-sm text-muted-foreground">Fill Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-2xl mx-auto text-center mt-20">
          <h2 className="text-3xl font-bold mb-4">Ready to optimize your scheduling?</h2>
          <p className="text-muted-foreground mb-8">
            Join leading home care agencies using AI-powered workforce management
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
            Get Started Now
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
