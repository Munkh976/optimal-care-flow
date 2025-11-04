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
import { ShiftDetailsDialog } from "@/components/schedule/ShiftDetailsDialog";

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
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const [caregiverProfile, setCaregiverProfile] = useState<any>(null);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [careTypes, setCareTypes] = useState<any[]>([]);

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
      if (caregiverProfile) {
        fetchScheduleData(caregiverProfile.agency_id, caregiverProfile.id);
      } else {
        fetchScheduleData(user.id, null);
      }
    }
  }, [currentWeekStart, user, caregiverProfile]);

  const fetchScheduleData = async (agencyId: string, caregiverId: string | null) => {
    setLoading(true);
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

    // Fetch care types for filter
    const { data: careTypesData } = await supabase
      .from("care_types")
      .select("*")
      .eq("is_active", true)
      .order("name");
    
    setCareTypes(careTypesData || []);

    // Fetch shifts with assignments and trade info
    const { data: shiftsData, error: shiftsError } = await supabase
      .from("shifts")
      .select(`
        *,
        client:clients(first_name, last_name, care_requirements, address, city, state, zip_code),
        shift_assignments(
          id,
          caregiver:caregivers(first_name, last_name),
          status,
          shift_trades:shift_trades(id, status, trade_type)
        )
      `)
      .eq("agency_id", agencyId)
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
      .eq("agency_id", agencyId)
      .eq("is_active", true);

    setCaregivers(caregiversData || []);

    // Fetch all clients
    const { data: clientsData } = await supabase
      .from("clients")
      .select("*")
      .eq("agency_id", agencyId);

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

  const formatCareType = (careType: string) => {
    const types: any = {
      personal_care: "Personal Care",
      companion: "Companion Care",
      medical: "Medical Care",
      respite: "Respite Care",
    };
    return types[careType] || careType;
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

  // Generate time slots from 6 AM to 10 PM (hourly)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getShiftsForDayAndTime = (dayOffset: number, timeSlot: string) => {
    const targetDate = format(addDays(currentWeekStart, dayOffset), "yyyy-MM-dd");
    const [slotHour] = timeSlot.split(':').map(Number);
    
    return shifts.filter(shift => {
      if (shift.shift_date !== targetDate) return false;
      if (selectedCategory !== "all" && shift.care_type_code !== selectedCategory) return false;
      
      // Apply assignment filter
      const hasAssignment = shift.shift_assignments && shift.shift_assignments.length > 0;
      const hasActiveTrade = hasAssignment && shift.shift_assignments.some((assignment: any) => 
        assignment.shift_trades && assignment.shift_trades.some((trade: any) => trade.status === 'pending')
      );

      if (assignmentFilter === "unassigned" && hasAssignment) return false;
      if (assignmentFilter === "assigned" && !hasAssignment) return false;
      if (assignmentFilter === "in_trade" && !hasActiveTrade) return false;
      
      const [startHour] = shift.start_time.split(':').map(Number);
      return startHour === slotHour;
    });
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
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
                <SelectItem value="in_trade">In Trade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Week Navigation and AI Match */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
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
              {!caregiverProfile && (
                <Button 
                  variant="default"
                  onClick={() => {
                    const weekStart = format(currentWeekStart, "yyyy-MM-dd");
                    const weekEnd = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
                    navigate(`/auto-schedule?weekStart=${weekStart}&weekEnd=${weekEnd}`);
                  }}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  AI Match This Week
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Calendar Grid View - Days as Rows, Time Slots as Columns */}
        <Card>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {/* Header Row - Time Slots */}
                <div className="flex border-b">
                  <div className="w-24 flex-shrink-0 p-2 font-semibold border-r bg-muted/50">
                    Day
                  </div>
                  {timeSlots.map((slot) => (
                    <div key={slot} className="w-32 flex-shrink-0 p-2 text-center text-xs font-medium border-r bg-muted/50">
                      {slot}
                    </div>
                  ))}
                </div>

                {/* Day Rows */}
                {weekDays.map((day, dayIndex) => {
                  const currentDate = addDays(currentWeekStart, dayIndex);
                  
                  return (
                    <div key={dayIndex} className="flex border-b hover:bg-muted/20 transition-colors">
                      {/* Day Label */}
                      <div className="w-24 flex-shrink-0 p-2 border-r bg-card">
                        <div className="font-semibold text-sm">{day}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(currentDate, "MMM dd")}
                        </div>
                      </div>

                      {/* Time Slot Cells */}
                      {timeSlots.map((slot) => {
                        const shiftsInSlot = getShiftsForDayAndTime(dayIndex, slot);
                        
                        return (
                          <div key={slot} className="w-32 flex-shrink-0 p-1 border-r min-h-[80px] bg-card">
                            <div className="space-y-1">
                              {shiftsInSlot.map((shift) => (
                                <div
                                  key={shift.id}
                                  className={`p-1.5 rounded text-xs cursor-pointer hover:shadow-sm transition-shadow ${getCareTypeColor(shift.care_type_code)}`}
                                   onClick={() => {
                                    setSelectedShift(shift);
                                    setIsDetailsOpen(true);
                                  }}
                                >
                                  <div className="font-medium truncate text-xs">
                                    {shift.order_title}
                                  </div>
                                  <div className="text-[10px] opacity-80">
                                    {shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}
                                  </div>
                                  {shift.shift_assignments && shift.shift_assignments.length > 0 ? (
                                    <>
                                      <div className="text-[10px] font-medium mt-0.5 truncate">
                                        {shift.shift_assignments[0].caregiver?.first_name} {shift.shift_assignments[0].caregiver?.last_name}
                                      </div>
                                      {shift.shift_assignments[0].shift_trades && 
                                       shift.shift_assignments[0].shift_trades.some((trade: any) => trade.status === 'pending') && (
                                        <div className="text-[10px] text-amber-600 italic mt-0.5">
                                          In Trade
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-[10px] text-destructive italic mt-0.5">
                                        Unassigned
                                      </div>
                                      {!caregiverProfile && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-[10px] h-5 px-1 mt-1 w-full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/quick-assign?shift=${shift.id}`);
                                          }}
                                        >
                                          Quick Assign
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

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

      {/* Shift Details Dialog */}
      <ShiftDetailsDialog 
        shift={selectedShift}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </div>
  );
};

export default Schedule;
