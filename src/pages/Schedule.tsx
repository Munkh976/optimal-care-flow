import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, LogOut, Activity } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, subWeeks, subMonths, eachDayOfInterval, isSameDay, isToday, addDays } from "date-fns";
import { toast } from "sonner";
import { ShiftDetailsDialog } from "@/components/schedule/ShiftDetailsDialog";

const Schedule = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<any[]>([]);
  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState(null);
  const [careTypes, setCareTypes] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [caregiverProfile, setCaregiverProfile] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, [currentDate, view]);

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
    }

    // Check if user is a caregiver
    const { data: caregiverData } = await supabase
      .from("caregivers")
      .select("*")
      .eq("email", session.user.email)
      .maybeSingle();

    if (caregiverData) {
      setCaregiverProfile(caregiverData);
      await fetchScheduleData(caregiverData.agency_id, caregiverData.id);
    } else if (profileData) {
      await fetchScheduleData(session.user.id, null);
    }
  };

  const fetchScheduleData = async (userId, caregiverId = null) => {
    try {
      setLoading(true);
      
      const startDate = view === "week" 
        ? startOfWeek(currentDate)
        : startOfMonth(currentDate);
      
      const endDate = view === "week"
        ? endOfWeek(currentDate)
        : endOfMonth(currentDate);

      // Fetch care types
      const { data: careTypesData } = await supabase
        .from("care_types")
        .select("*")
        .order("name");
      setCareTypes(careTypesData || []);

      // Fetch shifts
      const shiftsQuery = supabase
        .from("shifts")
        .select(`
          *,
          clients (
            first_name,
            last_name,
            address,
            city,
            state,
            zip_code
          ),
          care_types (
            name
          )
        `)
        .eq("agency_id", userId)
        .gte("shift_date", format(startDate, "yyyy-MM-dd"))
        .lte("shift_date", format(endDate, "yyyy-MM-dd"))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (caregiverId) {
        shiftsQuery.eq("caregiver_id", caregiverId);
      }

      const { data: shiftsData, error } = await shiftsQuery;

      if (error) throw error;
      setShifts(shiftsData || []);

      // Fetch caregivers
      const { data: caregiversData } = await supabase
        .from("caregivers")
        .select("*")
        .eq("agency_id", userId)
        .eq("is_active", true);
      setCaregivers(caregiversData || []);

      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("*")
        .eq("agency_id", userId);
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const goToPrevious = () => {
    if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
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

  const getShiftsForDay = (day) => {
    return filteredShifts.filter(shift => 
      isSameDay(new Date(shift.shift_date), day)
    );
  };

  const formatCareType = (code) => {
    const careType = careTypes.find(ct => ct.code === code);
    return careType?.name || code;
  };

  const getCareTypeColor = (type) => {
    const colors = {
      personal_care: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      companionship: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      medication: "bg-green-500/10 text-green-600 border-green-500/20",
      mobility: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      dementia_care: "bg-pink-500/10 text-pink-600 border-pink-500/20",
      hospice: "bg-gray-500/10 text-gray-600 border-gray-500/20"
    };
    return colors[type] || "bg-muted";
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  };

  const getShiftsForDayAndTime = (day, time) => {
    const [slotHour] = time.split(':').map(Number);
    
    return filteredShifts.filter(shift => {
      if (!isSameDay(new Date(shift.shift_date), day)) return false;
      
      const [startHour] = shift.start_time.split(':').map(Number);
      return startHour === slotHour;
    });
  };

  // Apply filters
  const filteredShifts = shifts.filter(shift => {
    if (categoryFilter !== "all" && shift.care_type_code !== categoryFilter) return false;
    
    const hasAssignment = shift.caregiver_id !== null;
    
    if (assignmentFilter === "unassigned" && hasAssignment) return false;
    if (assignmentFilter === "assigned" && !hasAssignment) return false;
    
    return true;
  });

  const isCaregiverUser = !!caregiverProfile;

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
            <h2 className="text-3xl font-bold mb-2">Schedule</h2>
            <p className="text-muted-foreground">View and manage shifts</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Care Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Care Types</SelectItem>
                {careTypes.map((type) => (
                  <SelectItem key={type.code} value={type.code}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Shifts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Calendar Navigation */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  {format(currentDate, view === "week" ? "'Week of' MMM d, yyyy" : "MMMM yyyy")}
                </h2>
              </div>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevious}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNext}
                >
                  Next
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-card rounded-lg border border-border/40 overflow-hidden">
              {view === "week" ? (
                <>
                  {/* Week View - Days Header */}
                  <div className="grid grid-cols-8 border-b border-border/40 bg-muted/30">
                    <div className="p-2 text-center text-xs font-semibold text-muted-foreground">
                      Time
                    </div>
                    {getDaysInView().map((day, i) => {
                      const isCurrentDay = isToday(day);
                      return (
                        <div
                          key={i}
                          className={`p-2 text-center ${
                            isCurrentDay
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground"
                          }`}
                        >
                          <div className="text-xs font-semibold">
                            {format(day, "EEE")}
                          </div>
                          <div className="text-lg">{format(day, "d")}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Week View - Time Slots */}
                  <div className="divide-y divide-border/40">
                    {generateTimeSlots().map((time) => (
                      <div key={time} className="grid grid-cols-8 min-h-[80px]">
                        <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20 flex items-center justify-center">
                          {time}
                        </div>
                        {getDaysInView().map((day, i) => {
                          const shifts = getShiftsForDayAndTime(day, time);
                          return (
                            <div
                              key={i}
                              className="p-1 border-l border-border/40 min-h-[80px]"
                            >
                              <div className="space-y-1">
                                {shifts.map((shift) => (
                                  <Card
                                    key={shift.id}
                                    className={`cursor-pointer hover:shadow-md transition-shadow ${getCareTypeColor(
                                      shift.care_type_code
                                    )}`}
                                    onClick={() => setSelectedShift(shift)}
                                  >
                                    <CardContent className="p-2">
                                      <div className="text-xs font-semibold truncate">
                                        {shift.clients?.first_name}{" "}
                                        {shift.clients?.last_name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {shift.start_time.slice(0, 5)} -{" "}
                                        {shift.end_time.slice(0, 5)}
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className="text-xs mt-1"
                                      >
                                        {formatCareType(shift.care_type_code)}
                                      </Badge>
                                      {!shift.caregiver_id && !isCaregiverUser && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-6 px-2 mt-1 w-full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/quick-assign?shift=${shift.id}`);
                                          }}
                                        >
                                          Quick Assign
                                        </Button>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* Month View - Calendar Grid */
                <div className="grid grid-cols-7 gap-2 p-4">
                  {getDaysInView().map((day, idx) => {
                    const dayShifts = getShiftsForDay(day);
                    const isCurrentDay = isToday(day);
                    
                    return (
                      <div
                        key={idx}
                        className={`min-h-[120px] p-3 rounded-lg border ${
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
                        
                        <div className="space-y-1">
                          {dayShifts.map((shift) => (
                            <Card
                              key={shift.id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => setSelectedShift(shift)}
                            >
                              <CardContent className="p-2 space-y-1">
                                <div className="text-xs font-medium truncate">
                                  {shift.clients?.first_name} {shift.clients?.last_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {shift.start_time.slice(0, 5)}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Shifts</div>
              <div className="text-2xl font-bold">{shifts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Assigned</div>
              <div className="text-2xl font-bold">
                {shifts.filter(s => s.caregiver_id).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Unassigned</div>
              <div className="text-2xl font-bold text-destructive">
                {shifts.filter(s => !s.caregiver_id).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Active Caregivers</div>
              <div className="text-2xl font-bold">{caregivers.length}</div>
            </CardContent>
          </Card>
        </div>
      </main>

      <ShiftDetailsDialog
        shift={selectedShift}
        open={!!selectedShift}
        onOpenChange={(open) => !open && setSelectedShift(null)}
      />
    </div>
  );
};

export default Schedule;
