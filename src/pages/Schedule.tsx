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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar,
  LogOut,
  Activity,
  Clock,
  User,
  Users,
  Heart,
  Pill,
  Stethoscope,
  AlertCircle,
  Bath,
  Utensils,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, subWeeks, subMonths, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { toast } from "sonner";
import { ShiftDetailsDialog } from "@/components/schedule/ShiftDetailsDialog";

const Schedule = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<any[]>([]);
  const [scheduleView, setScheduleView] = useState<"timeline" | "grid" | "patient">("timeline");
  const [dateView, setDateView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState(null);
  const [selectedMultipleShifts, setSelectedMultipleShifts] = useState<{ time: string; shifts: any[] } | null>(null);
  const [careTypes, setCareTypes] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [caregiverProfile, setCaregiverProfile] = useState<any>(null);
  const [shiftAssignments, setShiftAssignments] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, [currentDate, dateView]);

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
      
      const startDate = dateView === "week" 
        ? startOfWeek(currentDate)
        : startOfMonth(currentDate);
      
      const endDate = dateView === "week"
        ? endOfWeek(currentDate)
        : endOfMonth(currentDate);

      // Fetch care types
      const { data: careTypesData } = await supabase
        .from("care_types")
        .select("*")
        .order("name");
      setCareTypes(careTypesData || []);

      // Fetch shifts with assignments
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
            name,
            code
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

      // Fetch shift assignments
      if (shiftsData) {
        const shiftIds = shiftsData.map(s => s.id);
        const { data: assignmentsData } = await supabase
          .from("shift_assignments")
          .select("*")
          .in("shift_id", shiftIds);
        setShiftAssignments(assignmentsData || []);
      }

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
    if (dateView === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (dateView === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDaysInView = () => {
    if (dateView === "week") {
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

  // Helper functions for care type icons and colors
  const getCareIcon = (careTypeCode: string) => {
    const icons = {
      personal_care: <Bath className="w-4 h-4" />,
      medication: <Pill className="w-4 h-4" />,
      medical: <Stethoscope className="w-4 h-4" />,
      mobility: <Activity className="w-4 h-4" />,
      companionship: <Users className="w-4 h-4" />,
      meal_prep: <Utensils className="w-4 h-4" />,
    };
    return icons[careTypeCode] || <Heart className="w-4 h-4" />;
  };

  const getCareColor = (careTypeCode: string) => {
    const colors = {
      personal_care: "hsl(var(--primary))",
      medication: "hsl(142, 76%, 36%)",
      medical: "hsl(0, 84%, 60%)",
      mobility: "hsl(262, 83%, 58%)",
      companionship: "hsl(189, 94%, 43%)",
      meal_prep: "hsl(38, 92%, 50%)",
    };
    return colors[careTypeCode] || "hsl(var(--muted))";
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "urgent":
        return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
      case "high":
        return <Badge variant="default" className="text-xs bg-orange-500">High Priority</Badge>;
      case "routine":
        return <Badge variant="secondary" className="text-xs">Routine</Badge>;
      default:
        return null;
    }
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

  const getAssignedCaregiver = (shift) => {
    if (!shift.caregiver_id) return null;
    return caregivers.find(c => c.id === shift.caregiver_id);
  };

  const getShiftPosition = (shift) => {
    const startHour = parseInt(shift.start_time.split(':')[0]);
    const startMinute = parseInt(shift.start_time.split(':')[1]);
    const basePosition = (startHour - 6) * 100 + (startMinute / 60) * 100;
    return basePosition;
  };

  const getShiftWidth = (duration) => {
    return duration * 100;
  };

  const getShiftsAtTime = (time: string) => {
    const timeMinutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
    return filteredShifts.filter(shift => {
      const startMinutes = parseInt(shift.start_time.split(':')[0]) * 60 + parseInt(shift.start_time.split(':')[1]);
      const endMinutes = parseInt(shift.end_time.split(':')[0]) * 60 + parseInt(shift.end_time.split(':')[1]);
      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
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

  // Timeline View Component (Caregiver-Centric)
  const TimelineView = () => {
    const hours = generateTimeSlots();
    const uniqueCaregivers = [...new Set(filteredShifts.map(s => s.caregiver_id).filter(Boolean))];
    
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Time header */}
          <div className="flex border-b-2 border-border pb-2 mb-4">
            <div className="w-40 font-medium text-muted-foreground">Caregiver</div>
            <div className="relative flex-1">
              <div className="flex">
                {hours.map((hour, idx) => (
                  <div key={hour} className="w-[100px] text-sm font-medium text-muted-foreground">
                    {hour}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Caregiver lanes */}
          {uniqueCaregivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No assigned caregivers in this period
            </div>
          ) : (
            uniqueCaregivers.map(caregiverId => {
              const caregiver = caregivers.find(c => c.id === caregiverId);
              const caregiverShifts = filteredShifts.filter(s => s.caregiver_id === caregiverId);
              
              if (!caregiver) return null;
              
              return (
                <div key={caregiverId} className="flex border-b border-border py-2 min-h-[80px]">
                  <div className="w-40 pr-4">
                    <div className="font-medium">{caregiver.first_name} {caregiver.last_name}</div>
                    <div className="text-xs text-muted-foreground">{caregiver.role}</div>
                  </div>
                  <div className="relative flex-1 h-16">
                    {caregiverShifts.map(shift => (
                      <div
                        key={shift.id}
                        className="absolute top-0 h-full rounded-lg border-2 border-white shadow-sm hover:shadow-lg transition-all cursor-pointer hover:z-10"
                        style={{
                          left: `${getShiftPosition(shift)}px`,
                          width: `${getShiftWidth(shift.duration_hours)}px`,
                          backgroundColor: getCareColor(shift.care_type_code),
                          opacity: 0.9
                        }}
                        onClick={() => setSelectedShift(shift)}
                      >
                        <div className="p-2 text-white h-full flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1">
                              {getCareIcon(shift.care_type_code)}
                              <span className="text-xs font-medium truncate">
                                {shift.clients?.first_name} {shift.clients?.last_name}
                              </span>
                            </div>
                            {shift.status === 'urgent' && (
                              <AlertCircle className="w-3 h-3 text-yellow-300" />
                            )}
                          </div>
                          <div className="text-xs opacity-90 truncate">
                            {formatCareType(shift.care_type_code)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Density Grid View Component (Time-Centric)
  const DensityGridView = () => {
    const timeSlots = generateTimeSlots().filter((_, idx) => idx % 2 === 0); // Every hour
    
    const ShiftBadge = ({ shift }) => (
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white cursor-pointer hover:scale-105 transition-transform"
        style={{ backgroundColor: getCareColor(shift.care_type_code) }}
        onClick={() => setSelectedShift(shift)}
      >
        {getCareIcon(shift.care_type_code)}
        <span className="truncate max-w-[100px]">
          {shift.clients?.first_name} {shift.clients?.last_name}
        </span>
        {shift.status === 'urgent' && <AlertCircle className="w-3 h-3" />}
      </div>
    );

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left py-2 px-3 font-medium w-24">Time</th>
              <th className="text-left py-2 px-3 font-medium">Active Care Sessions</th>
              <th className="text-center py-2 px-3 font-medium w-20">Count</th>
              <th className="text-center py-2 px-3 font-medium w-32">Staff Load</th>
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(time => {
              const activeShifts = getShiftsAtTime(time);
              const uniqueCaregivers = [...new Set(activeShifts.map(s => s.caregiver_id).filter(Boolean))];
              
              const getDensityColor = (count) => {
                if (count === 0) return 'bg-background';
                if (count <= 2) return 'bg-green-500/10';
                if (count <= 4) return 'bg-yellow-500/10';
                return 'bg-orange-500/10';
              };

              return (
                <tr key={time} className={`border-b ${getDensityColor(activeShifts.length)}`}>
                  <td className="py-3 px-3 font-medium">{time}</td>
                  <td className="py-3 px-3">
                    {activeShifts.length === 0 ? (
                      <span className="text-muted-foreground text-sm">No active shifts</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {activeShifts.slice(0, 3).map(shift => (
                          <ShiftBadge key={shift.id} shift={shift} />
                        ))}
                        {activeShifts.length > 3 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                              >
                                +{activeShifts.length - 3} more
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">All shifts at {time}</h4>
                                <div className="space-y-1">
                                  {activeShifts.slice(3).map(shift => (
                                    <div key={shift.id} className="flex items-center gap-2">
                                      <ShiftBadge shift={shift} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      activeShifts.length === 0 ? 'bg-muted text-muted-foreground' :
                      activeShifts.length <= 2 ? 'bg-green-500 text-white' :
                      activeShifts.length <= 4 ? 'bg-yellow-500 text-white' :
                      'bg-orange-500 text-white'
                    }`}>
                      {activeShifts.length}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex justify-center items-center gap-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{uniqueCaregivers.length} staff</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Patient Focus View Component (Patient-Centric)
  const PatientFocusView = () => {
    const uniquePatients = [...new Set(filteredShifts.map(s => s.client_id))];
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {uniquePatients.map(clientId => {
          const client = clients.find(c => c.id === clientId);
          if (!client) return null;
          
          const patientShifts = filteredShifts.filter(s => s.client_id === clientId);
          const totalCareHours = patientShifts.reduce((sum, s) => sum + (s.duration_hours || 0), 0);
          const careTypesUsed = [...new Set(patientShifts.map(s => s.care_type_code))];

          return (
            <Card key={clientId} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">{client.first_name} {client.last_name}</h3>
                    <p className="text-sm text-muted-foreground">{client.city}, {client.state}</p>
                  </div>
                  <UserCheck className="w-5 h-5 text-green-500" />
                </div>

                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span>{totalCareHours.toFixed(1)} hours of care</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {careTypesUsed.map(code => (
                      <div
                        key={code}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: getCareColor(code) }}
                        title={formatCareType(code)}
                      >
                        {getCareIcon(code)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {patientShifts.map(shift => (
                    <div
                      key={shift.id}
                      className="p-2 bg-muted/50 rounded-lg border-l-4 cursor-pointer hover:bg-muted transition-colors"
                      style={{ borderLeftColor: getCareColor(shift.care_type_code) }}
                      onClick={() => setSelectedShift(shift)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}
                          </span>
                          {shift.status && getUrgencyBadge(shift.status)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatCareType(shift.care_type_code)}
                      </div>
                      {shift.caregiver_id && (
                        <div className="text-xs text-muted-foreground mt-1">
                          by {caregivers.find(c => c.id === shift.caregiver_id)?.first_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
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

        {/* View and Navigation Controls */}
        <Card className="mb-6">
          <CardContent className="p-4">
            {/* View Toggle Tabs */}
            <div className="flex gap-2 border-b mb-4">
              <Button
                variant={scheduleView === "timeline" ? "default" : "ghost"}
                size="sm"
                onClick={() => setScheduleView("timeline")}
                className="rounded-b-none"
              >
                Timeline View
              </Button>
              <Button
                variant={scheduleView === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setScheduleView("grid")}
                className="rounded-b-none"
              >
                Density Grid
              </Button>
              <Button
                variant={scheduleView === "patient" ? "default" : "ghost"}
                size="sm"
                onClick={() => setScheduleView("patient")}
                className="rounded-b-none"
              >
                By Patient
              </Button>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  {format(currentDate, dateView === "week" ? "'Week of' MMM d, yyyy" : "MMMM yyyy")}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={dateView === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateView("week")}
                >
                  Week
                </Button>
                <Button
                  variant={dateView === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateView("month")}
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
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getCareColor('personal_care') }}></div>
                  <span className="text-sm">Personal Care</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getCareColor('medication') }}></div>
                  <span className="text-sm">Medication</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getCareColor('medical') }}></div>
                  <span className="text-sm">Medical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getCareColor('mobility') }}></div>
                  <span className="text-sm">Mobility</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getCareColor('companionship') }}></div>
                  <span className="text-sm">Companionship</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">High Priority Indicator</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main View Content */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {scheduleView === "timeline" && <TimelineView />}
            {scheduleView === "grid" && <DensityGridView />}
            {scheduleView === "patient" && <PatientFocusView />}
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
