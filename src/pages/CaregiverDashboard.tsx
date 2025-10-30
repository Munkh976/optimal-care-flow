import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, Star, TrendingUp, Briefcase, DollarSign, LogOut } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, startOfMonth, endOfMonth } from "date-fns";
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
    care_type: string;
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
  care_type: string;
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
  skills: string[];
}

const CaregiverDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CaregiverProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(true);
  const [caregiverId, setCaregiverId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetch();
  }, [currentDate, view]);

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

      // Find caregiver by agency_id (which should be user.id)
      const { data: caregiverData, error: caregiverError } = await supabase
        .from("caregivers")
        .select("*")
        .eq("agency_id", userId)
        .single();

      if (caregiverError) throw caregiverError;
      
      setProfile(caregiverData);
      setCaregiverId(caregiverData.id);

      const startDate = view === "week" 
        ? startOfWeek(currentDate)
        : startOfMonth(currentDate);
      
      const endDate = view === "week"
        ? endOfWeek(currentDate)
        : endOfMonth(currentDate);

      // Fetch assignments
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
        .gte("shifts.shift_date", format(startDate, "yyyy-MM-dd"))
        .lte("shifts.shift_date", format(endDate, "yyyy-MM-dd"))
        .order("shifts.shift_date", { ascending: true });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch open shifts
      const { data: openShiftsData, error: openShiftsError } = await supabase
        .from("shifts")
        .select(`
          *,
          clients (first_name, last_name, city)
        `)
        .eq("agency_id", userId)
        .eq("status", "open")
        .gte("shift_date", format(new Date(), "yyyy-MM-dd"))
        .order("shift_date", { ascending: true })
        .limit(10);

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

  const getDaysInView = () => {
    if (view === "week") {
      return eachDayOfInterval({
        start: startOfWeek(currentDate),
        end: endOfWeek(currentDate)
      });
    }
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate)
    });
  };

  const getAssignmentsForDay = (day: Date) => {
    return assignments.filter(assignment => 
      assignment.shifts && isSameDay(new Date(assignment.shifts.shift_date), day)
    );
  };

  const getUpcomingShifts = () => {
    return assignments
      .filter(a => a.shifts && new Date(a.shifts.shift_date) >= new Date())
      .slice(0, 5);
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
      hospice: "bg-gray-500/10 text-gray-600 border-gray-500/20"
    };
    return colors[type as keyof typeof colors] || "bg-muted";
  };

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
                {format(new Date(), "EEEE, MMMM d, yyyy")}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Performance</p>
                  <p className="text-2xl font-bold">{profile?.performance_rating.toFixed(1)}/5.0</p>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reliability</p>
                  <p className="text-2xl font-bold">{profile?.reliability_score}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Week</p>
                  <p className="text-2xl font-bold">{getAssignmentsForDay(new Date()).length} Shifts</p>
                </div>
                <Briefcase className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hourly Rate</p>
                  <p className="text-2xl font-bold">${profile?.hourly_rate}</p>
                </div>
                <DollarSign className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="schedule">My Schedule</TabsTrigger>
            <TabsTrigger value="open-shifts">Open Shifts</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          </TabsList>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Schedule Calendar</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={view === "week" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setView("week")}
                    >
                      Week
                    </Button>
                    <Button
                      variant={view === "month" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setView("month")}
                    >
                      Month
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className={view === "week" ? "grid grid-cols-7 gap-4" : "grid grid-cols-7 gap-2"}>
                  {getDaysInView().map((day, idx) => {
                    const dayAssignments = getAssignmentsForDay(day);
                    const isCurrentDay = isToday(day);
                    
                    return (
                      <div
                        key={idx}
                        className={`min-h-[150px] p-3 rounded-lg border ${
                          isCurrentDay
                            ? "bg-primary/5 border-primary/30"
                            : "bg-card border-border/40"
                        }`}
                      >
                        <div className="text-center mb-2">
                          <div className="text-xs text-muted-foreground">
                            {format(day, "EEE")}
                          </div>
                          <div className={`text-lg font-semibold ${
                            isCurrentDay ? "text-primary" : "text-foreground"
                          }`}>
                            {format(day, "d")}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          {dayAssignments.map((assignment) => (
                            <Card
                              key={assignment.id}
                              className="bg-primary/5 border-primary/20"
                            >
                              <CardContent className="p-2 space-y-1">
                                <p className="text-xs font-medium truncate">
                                  {assignment.shifts?.clients?.first_name}
                                </p>
                                <Badge className={`text-xs ${getStatusColor(assignment.status)}`}>
                                  {assignment.status}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{assignment.shifts?.start_time.slice(0, 5)}</span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Open Shifts Tab */}
          <TabsContent value="open-shifts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Available Open Shifts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {openShifts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No open shifts available</p>
                ) : (
                  openShifts.map((shift) => (
                    <Card key={shift.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">
                                {shift.clients?.first_name} {shift.clients?.last_name}
                              </p>
                              {shift.ai_match_score && (
                                <Badge className="bg-success/10 text-success border-success/20">
                                  {shift.ai_match_score}% Match
                                </Badge>
                              )}
                            </div>
                            <Badge className={getCareTypeColor(shift.care_type)}>
                              {shift.care_type.replace(/_/g, " ")}
                            </Badge>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{format(new Date(shift.shift_date), "MMM d, yyyy")}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span>{shift.clients?.city}</span>
                              </div>
                            </div>
                          </div>
                          <Button onClick={() => handlePickUpShift(shift.id)}>
                            Pick Up Shift
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upcoming Shifts Tab */}
          <TabsContent value="upcoming" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Shifts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {getUpcomingShifts().length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No upcoming shifts</p>
                ) : (
                  getUpcomingShifts().map((assignment) => (
                    <Card key={assignment.id} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">
                              {assignment.shifts?.clients?.first_name} {assignment.shifts?.clients?.last_name}
                            </p>
                            <Badge className={getStatusColor(assignment.status)}>
                              {assignment.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(assignment.shifts.shift_date), "MMM d, yyyy")}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{assignment.shifts.start_time.slice(0, 5)} - {assignment.shifts.end_time.slice(0, 5)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{assignment.shifts.clients?.address}, {assignment.shifts.clients?.city}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CaregiverDashboard;
