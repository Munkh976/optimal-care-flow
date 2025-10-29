import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, Calendar, Clock, User, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const Schedule = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        fetchShifts(session.user.id);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchShifts = async (userId: string) => {
    const { data, error } = await supabase
      .from("shifts")
      .select(`
        *,
        clients (first_name, last_name, address, city),
        caregivers (first_name, last_name, email, phone)
      `)
      .eq("agency_id", userId)
      .order("shift_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching shifts:", error);
      toast.error("Failed to load shifts");
    } else {
      setShifts(data || []);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-warning/10 text-warning border-warning/20";
      case "assigned": return "bg-primary/10 text-primary border-primary/20";
      case "in_progress": return "bg-accent/10 text-accent border-accent/20";
      case "completed": return "bg-success/10 text-success border-success/20";
      case "cancelled": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted";
    }
  };

  const getCareTypeColor = (type: string) => {
    switch (type) {
      case "personal_care": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "companionship": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "medication": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "mobility": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "dementia_care": return "bg-pink-500/10 text-pink-500 border-pink-500/20";
      case "hospice": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default: return "bg-muted";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Schedule Management</h2>
            <p className="text-muted-foreground">View and manage all shifts</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Shift
          </Button>
        </div>

        {/* Shifts Grid */}
        <div className="grid gap-4">
          {shifts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">No shifts scheduled yet</p>
                <Button className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Shift
                </Button>
              </CardContent>
            </Card>
          ) : (
            shifts.map((shift) => (
              <Card key={shift.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">
                          {shift.clients?.first_name} {shift.clients?.last_name}
                        </CardTitle>
                        <Badge variant="outline" className={getStatusColor(shift.status)}>
                          {shift.status.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline" className={getCareTypeColor(shift.care_type)}>
                          {shift.care_type.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(shift.shift_date), "MMM dd, yyyy")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {shift.start_time} - {shift.end_time} ({shift.duration_hours}h)
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {shift.clients?.city}
                        </div>
                      </div>
                    </div>
                    {shift.ai_match_score && (
                      <div className="flex flex-col items-center">
                        <div className="text-2xl font-bold text-primary">{shift.ai_match_score}%</div>
                        <div className="text-xs text-muted-foreground">AI Match</div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {shift.caregivers ? (
                    <div className="flex items-center gap-2 mb-3 p-3 bg-accent/5 rounded-lg">
                      <User className="h-4 w-4 text-accent" />
                      <div>
                        <p className="text-sm font-medium">
                          {shift.caregivers.first_name} {shift.caregivers.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{shift.caregivers.phone}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 p-3 bg-warning/5 rounded-lg border border-warning/20">
                      <p className="text-sm text-warning">No caregiver assigned</p>
                    </div>
                  )}
                  {shift.special_instructions && (
                    <p className="text-sm text-muted-foreground mb-3">
                      <span className="font-medium">Instructions:</span> {shift.special_instructions}
                    </p>
                  )}
                  {shift.required_skills && shift.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {shift.required_skills.map((skill: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Schedule;
