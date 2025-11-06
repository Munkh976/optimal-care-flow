import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Briefcase, DollarSign, LogOut, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Assignment {
  id: string;
  status: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  shifts: {
    id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    care_type_code: string;
    duration_hours: number;
    clients: {
      first_name: string;
      last_name: string;
      address: string;
      city: string;
    };
  };
}

interface OpenShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  care_type_code: string;
  ai_match_score: number | null;
  clients: {
    first_name: string;
    last_name: string;
    city: string;
  };
}

interface CaregiverProfile {
  id: string;
  first_name: string;
  last_name: string;
  performance_rating: number;
  reliability_score: number;
  hourly_rate: number;
}

const CaregiverDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CaregiverProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [caregiverId, setCaregiverId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    await fetchCaregiverData(user.id);
  };

  const fetchCaregiverData = async (userId: string) => {
    try {
      setLoading(true);

      // Find caregiver by user_id
      const { data: caregiverData, error: caregiverError } = await supabase
        .from("caregivers")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (caregiverError) throw caregiverError;
      
      setProfile(caregiverData);
      setCaregiverId(caregiverData.id);

      // Fetch assignments for upcoming shifts
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("shift_assignments")
        .select(`
          *,
          shifts (
            *,
            clients (first_name, last_name, address, city)
          )
        `)
        .eq("caregiver_id", caregiverData.id)
        .gte("shifts.shift_date", format(new Date(), "yyyy-MM-dd"))
        .order("shifts.shift_date", { ascending: true })
        .limit(10);

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch open shifts - using agency_id from caregiver's profile
      const { data: openShiftsData, error: openShiftsError } = await supabase
        .from("shifts")
        .select(`
          *,
          clients (first_name, last_name, city)
        `)
        .eq("agency_id", caregiverData.agency_id)
        .eq("status", "open")
        .gte("shift_date", format(new Date(), "yyyy-MM-dd"))
        .order("shift_date", { ascending: true })
        .limit(3);

      if (openShiftsError) throw openShiftsError;
      setOpenShifts(openShiftsData || []);

    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handlePickUpShift = async (shiftId: string) => {
    if (!caregiverId) return;

    try {
      const { error: assignError } = await supabase
        .from("shift_assignments")
        .insert({
          shift_id: shiftId,
          caregiver_id: caregiverId,
          status: "scheduled",
          assignment_method: "picked_up"
        });

      if (assignError) throw assignError;

      const { error: updateError } = await supabase
        .from("shifts")
        .update({ status: "assigned" })
        .eq("id", shiftId);

      if (updateError) throw updateError;

      toast.success("Shift picked up successfully!");
      checkAuthAndFetch();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to pick up shift");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const getStatusColor = (status: string) => {
    const colors = {
      scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      confirmed: "bg-green-500/10 text-green-600 border-green-500/20",
      in_progress: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      completed: "bg-gray-500/10 text-gray-600 border-gray-500/20"
    };
    return colors[status as keyof typeof colors] || "bg-muted";
  };

  const getCareTypeColor = (type: string) => {
    const colors = {
      personal_care: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      companionship: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      medication: "bg-green-500/10 text-green-600 border-green-500/20",
      mobility: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      dementia_care: "bg-pink-500/10 text-pink-600 border-pink-500/20",
      hospice: "bg-gray-500/10 text-gray-600 border-gray-500/20",
      skilled_nursing: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
    };
    return colors[type as keyof typeof colors] || "bg-muted";
  };

  // Calculate weekly hours and earnings
  const weeklyHours = assignments.reduce((sum, a) => sum + (a.shifts?.duration_hours || 0), 0);
  const weeklyEarnings = profile ? weeklyHours * profile.hourly_rate : 0;
  const minHoursRequired = 35; // Default full-time minimum

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-border/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {profile?.first_name}! 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                Here's your schedule and stats for this week
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">HOURS THIS WEEK</p>
                  <p className="text-4xl font-bold mt-2">{weeklyHours}/{minHoursRequired}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
              {weeklyHours < minHoursRequired && (
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Below Minimum
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">ESTIMATED EARNINGS</p>
                  <p className="text-4xl font-bold mt-2">${weeklyEarnings.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
              <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
                <DollarSign className="w-4 h-4 mr-2" />
                Get Instant Pay
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">RELIABILITY SCORE</p>
                  <p className="text-4xl font-bold mt-2">{profile?.reliability_score}%</p>
                </div>
                <Briefcase className="w-8 h-8 text-purple-500" />
              </div>
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                ⭐ Elite Status
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Your Upcoming Shifts */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">Your Upcoming Shifts</h2>
            {assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                <AlertCircle className="w-12 h-12 text-cyan-500 mb-4" />
                <p className="text-lg font-medium text-cyan-600">No upcoming shifts scheduled</p>
                <p className="text-sm text-muted-foreground">Check the trade board for available shifts!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <Card key={assignment.id} className="border-l-4 border-primary hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-lg">
                              {assignment.shifts?.clients?.first_name} {assignment.shifts?.clients?.last_name}
                            </p>
                            <Badge className={getStatusColor(assignment.status)}>
                              {assignment.status}
                            </Badge>
                            <Badge className={getCareTypeColor(assignment.shifts?.care_type_code)}>
                              {assignment.shifts?.care_type_code.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(assignment.shifts?.shift_date), "MMM d, yyyy")}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{assignment.shifts?.start_time.slice(0, 5)} - {assignment.shifts?.end_time.slice(0, 5)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{assignment.shifts?.clients?.city}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trade Board & Extra Hours */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">💼 Available Shifts</h3>
                  <p className="text-sm text-muted-foreground">{openShifts.length} open shifts ready to pick up!</p>
                </div>
              </div>
              <Button className="w-full" onClick={() => navigate("/available-shifts")}>
                Browse Available Shifts
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">🏖️ Time Off</h3>
                  <p className="text-sm text-muted-foreground">Request vacation or sick leave</p>
                </div>
              </div>
              <Button className="w-full" onClick={() => navigate("/caregiver-time-off")}>
                Manage Time Off
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CaregiverDashboard;
