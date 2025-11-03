import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, LogOut, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Schedule = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [shifts, setShifts] = useState<any[]>([]);
  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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
        await fetchScheduleData(session.user.id);
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

  useEffect(() => {
    if (user) {
      fetchScheduleData(user.id);
    }
  }, [currentWeekStart, user]);

  const fetchScheduleData = async (userId: string) => {
    setLoading(true);
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

    // Fetch shifts with assignments
    const { data: shiftsData, error: shiftsError } = await supabase
      .from("shifts")
      .select(`
        *,
        client:clients(first_name, last_name, care_requirements),
        shift_assignments(
          id,
          caregiver:caregivers(first_name, last_name),
          status
        )
      `)
      .eq("agency_id", userId)
      .gte("shift_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("shift_date", format(weekEnd, "yyyy-MM-dd"))
      .order("shift_date", { ascending: true });

    if (shiftsError) {
      console.error("Error fetching shifts:", shiftsError);
      toast.error("Failed to load schedule");
    } else {
      setShifts(shiftsData || []);
    }

    // Fetch all caregivers
    const { data: caregiversData } = await supabase
      .from("caregivers")
      .select("*")
      .eq("agency_id", userId)
      .eq("is_active", true);

    setCaregivers(caregiversData || []);

    // Fetch all clients
    const { data: clientsData } = await supabase
      .from("clients")
      .select("*")
      .eq("agency_id", userId);

    setClients(clientsData || []);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const getShiftsForDay = (dayOffset: number) => {
    const targetDate = format(addDays(currentWeekStart, dayOffset), "yyyy-MM-dd");
    return shifts.filter(shift => shift.shift_date === targetDate);
  };

  const getCareTypeColor = (careType: string) => {
    const colors: any = {
      personal_care: "bg-primary/10 text-primary border-primary/20",
      companion: "bg-accent/10 text-accent border-accent/20",
      medical: "bg-destructive/10 text-destructive border-destructive/20",
      respite: "bg-secondary/10 text-secondary border-secondary/20",
    };
    return colors[careType] || "bg-muted";
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      <header className="border-b bg-card sticky top-0 z-10">
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">Everyone's Schedule</h2>
            <p className="text-muted-foreground">Weekly view of all shifts and assignments</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="personal_care">Personal Care</SelectItem>
                <SelectItem value="companion">Companion</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="respite">Respite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Week Navigation */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  Week of {format(currentWeekStart, "MMM dd, yyyy")}
                </h3>
                <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
                  Today
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Calendar Grid - Days as Rows */}
        <div className="space-y-4">
          {weekDays.map((day, index) => {
            const currentDate = addDays(currentWeekStart, index);
            const dayShifts = getShiftsForDay(index).filter(
              shift => selectedCategory === "all" || shift.care_type === selectedCategory
            );

            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Day Header */}
                    <div className="lg:w-32 flex-shrink-0">
                      <div className="font-semibold text-lg">{day}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(currentDate, "MMM dd")}
                      </div>
                    </div>

                    {/* Shifts Row */}
                    <div className="flex-1 overflow-x-auto">
                      {dayShifts.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic py-2">No shifts</p>
                      ) : (
                        <div className="flex gap-3 pb-2">
                          {dayShifts.map((shift) => (
                            <div
                              key={shift.id}
                              className="flex-shrink-0 w-64 p-3 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => navigate(`/unassigned-shifts`)}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-medium">
                                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                </div>
                                <Badge variant="outline" className={`text-xs ${getCareTypeColor(shift.care_type)}`}>
                                  {shift.care_type?.replace("_", " ")}
                                </Badge>
                              </div>
                              
                              <div className="text-sm mb-1">
                                <span className="font-medium">
                                  {shift.client?.first_name} {shift.client?.last_name}
                                </span>
                              </div>

                              {shift.shift_assignments && shift.shift_assignments.length > 0 ? (
                                <div className="text-xs text-primary">
                                  {shift.shift_assignments[0].caregiver?.first_name}{" "}
                                  {shift.shift_assignments[0].caregiver?.last_name}
                                </div>
                              ) : (
                                <div className="text-xs text-destructive italic">Unassigned</div>
                              )}

                              {shift.client?.care_requirements && shift.client.care_requirements.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {shift.client.care_requirements.slice(0, 2).map((req: string, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {req}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="grid sm:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Shifts</div>
              <div className="text-2xl font-bold">{shifts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Assigned</div>
              <div className="text-2xl font-bold text-primary">
                {shifts.filter(s => s.shift_assignments && s.shift_assignments.length > 0).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Unassigned</div>
              <div className="text-2xl font-bold text-destructive">
                {shifts.filter(s => !s.shift_assignments || s.shift_assignments.length === 0).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Active Caregivers</div>
              <div className="text-2xl font-bold text-accent">{caregivers.length}</div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Schedule;
