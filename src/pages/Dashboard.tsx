import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Calendar, TrendingUp, Sparkles, LogOut } from "lucide-react";
import DashboardStats from "@/components/dashboard/DashboardStats";
import UpcomingShifts from "@/components/dashboard/UpcomingShifts";
import CaregiverAvailability from "@/components/dashboard/CaregiverAvailability";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Fetch profile
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
      } else {
        setProfile(profileData);
      }

      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">CareMuch</h1>
              <p className="text-sm text-muted-foreground">{profile?.agency_name || "Care Agency"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.full_name || user?.email}
            </span>
            <Button variant="outline" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {profile?.full_name?.split(" ")[0] || "there"}!
          </h2>
          <p className="text-muted-foreground">Here's what's happening with your care team today.</p>
        </div>

        {/* Stats */}
        <DashboardStats />

        {/* Main Dashboard Grid */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          {/* Upcoming Shifts */}
          <UpcomingShifts />

          {/* Caregiver Availability */}
          <CaregiverAvailability />
        </div>

        {/* AI Insights Card */}
        <Card className="mt-6 border-accent/20 bg-gradient-to-br from-card to-accent/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <CardTitle>AI Scheduling Insights</CardTitle>
            </div>
            <CardDescription>Machine learning-powered recommendations for optimal scheduling</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="font-medium">Optimal Match Rate: 94%</p>
                  <p className="text-sm text-muted-foreground">
                    Your current scheduling achieves excellent caregiver-client matching
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Calendar className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="font-medium">5 shifts optimized this week</p>
                  <p className="text-sm text-muted-foreground">
                    AI adjusted schedules to reduce travel time by 23 minutes
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Users className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="font-medium">3 caregivers approaching overtime</p>
                  <p className="text-sm text-muted-foreground">
                    Consider redistributing hours to maintain work-life balance
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" onClick={() => navigate("/schedule")}>
            <Calendar className="h-6 w-6" />
            <span>Everyone's Schedule</span>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" onClick={() => navigate("/unassigned-shifts")}>
            <Activity className="h-6 w-6" />
            <span>Unassigned Shifts</span>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" onClick={() => navigate("/quick-assign")}>
            <TrendingUp className="h-6 w-6" />
            <span>Quick Assign</span>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" onClick={() => navigate("/caregiver-dashboard")}>
            <Users className="h-6 w-6" />
            <span>Caregiver Portal</span>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" onClick={() => navigate("/caregivers")}>
            <Users className="h-6 w-6" />
            <span>Manage Staff</span>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;