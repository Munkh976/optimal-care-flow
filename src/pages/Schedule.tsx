import { useEffect, useState, useMemo } from "react";
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
  Calendar,
  LogOut,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  BarChart,
  Star,
  Phone,
  MessageCircle,
  Plus,
  Home,
  Shield,
  Brain,
  Moon,
  AlertTriangle,
  Heart,
  Bath,
  ShoppingCart,
  UserCheck,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { toast } from "sonner";
import { ShiftDetailsDialog } from "@/components/schedule/ShiftDetailsDialog";

// Service Categories Configuration
const SERVICE_CATEGORIES = {
  ADL: {
    name: 'Activities of Daily Living',
    color: 'hsl(217, 91%, 60%)',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-600',
    borderClass: 'border-blue-500/20',
  },
  IADL: {
    name: 'Instrumental Activities',
    color: 'hsl(142, 76%, 36%)',
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-600',
    borderClass: 'border-green-500/20',
  },
  Health: {
    name: 'Health Monitoring',
    color: 'hsl(0, 84%, 60%)',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-600',
    borderClass: 'border-red-500/20',
  },
  Cognitive: {
    name: 'Cognitive Support',
    color: 'hsl(262, 83%, 58%)',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-600',
    borderClass: 'border-purple-500/20',
  },
  Safety: {
    name: 'Safety & Transportation',
    color: 'hsl(38, 92%, 50%)',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600',
    borderClass: 'border-amber-500/20',
  },
  Specialized: {
    name: 'Specialized Care',
    color: 'hsl(330, 81%, 60%)',
    bgClass: 'bg-pink-500/10',
    textClass: 'text-pink-600',
    borderClass: 'border-pink-500/20',
  },
};

const Schedule = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<any[]>([]);
  const [scheduleView, setScheduleView] = useState<"timeline" | "density" | "caregiver" | "client">("timeline");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState(null);
  const [careTypes, setCareTypes] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [shiftAssignments, setShiftAssignments] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, [currentDate]);

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

  const fetchScheduleData = async (userId) => {
    try {
      setLoading(true);
      
      const startDate = startOfWeek(currentDate);
      const endDate = endOfWeek(currentDate);

      // Fetch care types
      const { data: careTypesData } = await supabase
        .from("care_types")
        .select("*")
        .order("name");
      setCareTypes(careTypesData || []);

      // Fetch shifts with assignments
      const { data: shiftsData, error } = await supabase
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
            code,
            category
          )
        `)
        .eq("agency_id", userId)
        .gte("shift_date", format(startDate, "yyyy-MM-dd"))
        .lte("shift_date", format(endDate, "yyyy-MM-dd"))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

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
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const goToNext = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(currentDate),
      end: endOfWeek(currentDate)
    });
  }, [currentDate]);

  const getCategoryForShift = (shift) => {
    const category = shift.care_types?.category;
    return SERVICE_CATEGORIES[category] || SERVICE_CATEGORIES.ADL;
  };

  const getAssignedCaregiver = (shift) => {
    const assignment = shiftAssignments.find(a => a.shift_id === shift.id);
    if (!assignment) return null;
    return caregivers.find(c => c.id === assignment.caregiver_id);
  };

  const filteredShifts = useMemo(() => {
    let filtered = [...shifts];

    if (categoryFilter !== "all") {
      filtered = filtered.filter(shift => shift.care_types?.category === categoryFilter);
    }

    if (assignmentFilter === "assigned") {
      filtered = filtered.filter(shift => shiftAssignments.some(a => a.shift_id === shift.id));
    } else if (assignmentFilter === "unassigned") {
      filtered = filtered.filter(shift => !shiftAssignments.some(a => a.shift_id === shift.id));
    }

    return filtered;
  }, [shifts, categoryFilter, assignmentFilter, shiftAssignments]);

  // Timeline View Component
  const TimelineView = () => {
    const timeSlots = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    const uniqueCaregivers = [...new Set(filteredShifts.map(s => s.caregiver_id).filter(Boolean))];

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="text-left p-4 font-medium w-40 sticky left-0 bg-muted">
                Caregiver
              </th>
              {timeSlots.map(time => (
                <th key={time} className="text-center p-4 font-medium min-w-[120px]">
                  {time}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-background">
            {uniqueCaregivers.map(caregiverId => {
              const caregiver = caregivers.find(c => c.id === caregiverId);
              if (!caregiver) return null;

              return (
                <tr key={caregiverId} className="border-t hover:bg-muted/50">
                  <td className="p-4 font-medium sticky left-0 bg-background">
                    <div>
                      <div className="font-semibold">{caregiver.first_name} {caregiver.last_name}</div>
                      <div className="text-sm text-muted-foreground">{caregiver.role || 'Caregiver'}</div>
                    </div>
                  </td>
                  {timeSlots.map(time => {
                    const shift = filteredShifts.find(s => 
                      s.caregiver_id === caregiverId && 
                      s.start_time.startsWith(time.split(':')[0])
                    );

                    if (shift) {
                      const category = getCategoryForShift(shift);

                      return (
                        <td key={time} className="p-2">
                          <div 
                            className="rounded-lg p-2 text-xs text-white cursor-pointer hover:shadow-lg transition-all"
                            style={{ 
                              backgroundColor: category.color,
                              minWidth: '100px'
                            }}
                            onClick={() => setSelectedShift(shift)}
                          >
                            <div className="font-semibold">{shift.clients?.first_name} {shift.clients?.last_name}</div>
                            <div className="opacity-90">{shift.care_types?.name}</div>
                            <div className="opacity-80">{shift.duration_hours}hr</div>
                          </div>
                        </td>
                      );
                    }

                    return <td key={time} className="p-2"></td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Density Grid View
  const DensityGridView = () => {
    const timeSlots = ['Morning (6-12)', 'Afternoon (12-18)', 'Evening (18-24)'];

    return (
      <div className="overflow-x-auto">
        <div className="grid grid-cols-8 gap-4 min-w-[600px]">
          <div className="font-semibold text-foreground">Time / Day</div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className="text-center">
              <div className="font-semibold">{format(day, 'EEE')}</div>
              <div className="text-sm text-muted-foreground">{format(day, 'd')}</div>
            </div>
          ))}

          {timeSlots.map(slot => (
            <div key={slot} className="contents">
              <div className="font-medium text-muted-foreground py-3">{slot}</div>
              {weekDays.map(day => {
                const dayShifts = filteredShifts.filter(s => 
                  isSameDay(new Date(s.shift_date), day)
                );

                const density = dayShifts.length;
                const bgColor = density === 0 ? 'bg-muted' :
                              density <= 2 ? 'bg-green-500/20' :
                              density <= 4 ? 'bg-yellow-500/20' :
                              density <= 6 ? 'bg-orange-500/20' : 'bg-red-500/20';

                return (
                  <div 
                    key={day.toISOString()} 
                    className={`${bgColor} rounded-lg p-3 cursor-pointer hover:shadow-md transition-all`}
                  >
                    <div className="text-2xl font-bold text-center">{density}</div>
                    <div className="text-xs text-center text-muted-foreground">shifts</div>
                    {density > 4 && (
                      <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // By Caregiver View
  const ByCaregiverView = () => (
    <div className="space-y-6">
      {caregivers.map(caregiver => {
        const caregiverShifts = filteredShifts.filter(s => s.caregiver_id === caregiver.id);

        return (
          <Card key={caregiver.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-semibold">
                    {caregiver.first_name?.[0]}{caregiver.last_name?.[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{caregiver.first_name} {caregiver.last_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={`px-2 py-0.5 rounded ${SERVICE_CATEGORIES.ADL.bgClass} ${SERVICE_CATEGORIES.ADL.textClass}`}>
                        {caregiver.role || 'Caregiver'}
                      </span>
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span>{caregiver.performance_rating || 5.0}</span>
                      <span>• {caregiverShifts.length} shifts this week</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <MessageCircle className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Phone className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const dayShifts = caregiverShifts.filter(s => 
                    isSameDay(new Date(s.shift_date), day)
                  );

                  return (
                    <div key={day.toISOString()} className="border rounded-lg p-2 min-h-[100px]">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        {format(day, 'EEE d')}
                      </div>

                      {dayShifts.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">No shifts</div>
                      ) : (
                        <div className="space-y-1">
                          {dayShifts.map(shift => {
                            const category = getCategoryForShift(shift);

                            return (
                              <div 
                                key={shift.id}
                                className="rounded p-1 text-xs text-white cursor-pointer hover:shadow-md transition-all"
                                style={{ backgroundColor: category.color }}
                                onClick={() => setSelectedShift(shift)}
                              >
                                <div className="font-medium">{shift.start_time}</div>
                                <div className="truncate">{shift.clients?.first_name}</div>
                                <div className="truncate opacity-80">{shift.care_types?.name}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  // By Client View
  const ByClientView = () => (
    <div className="space-y-6">
      {clients.map(client => {
        const clientShifts = filteredShifts.filter(s => s.client_id === client.id);

        return (
          <Card key={client.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                    {client.first_name?.[0]}{client.last_name?.[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{client.first_name} {client.last_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{client.city}, {client.state}</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>
                </div>

                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Shift
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const dayShifts = clientShifts.filter(s => 
                    isSameDay(new Date(s.shift_date), day)
                  );

                  return (
                    <div key={day.toISOString()} className="border rounded-lg p-2 min-h-[100px]">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        {format(day, 'EEE d')}
                      </div>

                      {dayShifts.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">No care</div>
                      ) : (
                        <div className="space-y-1">
                          {dayShifts.map(shift => {
                            const caregiver = getAssignedCaregiver(shift);
                            const category = getCategoryForShift(shift);

                            return (
                              <div 
                                key={shift.id}
                                className="rounded p-1 text-xs text-white cursor-pointer hover:shadow-md transition-all"
                                style={{ backgroundColor: category.color }}
                                onClick={() => setSelectedShift(shift)}
                              >
                                <div className="font-medium">{shift.start_time}</div>
                                <div className="truncate">{caregiver?.first_name || 'Unassigned'}</div>
                                <div className="truncate opacity-80">{shift.care_types?.name}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalShifts = filteredShifts.length;
  const assignedShifts = filteredShifts.filter(s => shiftAssignments.some(a => a.shift_id === s.id)).length;
  const unassignedShifts = totalShifts - assignedShifts;
  const activeCaregivers = [...new Set(filteredShifts.map(s => s.caregiver_id).filter(Boolean))].length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Schedule Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage shifts and caregiver assignments
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
        {/* View Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant={scheduleView === "timeline" ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleView("timeline")}
              className="gap-2"
            >
              <List className="w-4 h-4" />
              Timeline
            </Button>
            <Button
              variant={scheduleView === "density" ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleView("density")}
              className="gap-2"
            >
              <Grid className="w-4 h-4" />
              Density
            </Button>
            <Button
              variant={scheduleView === "caregiver" ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleView("caregiver")}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              By Caregiver
            </Button>
            <Button
              variant={scheduleView === "client" ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleView("client")}
              className="gap-2"
            >
              <UserCheck className="w-4 h-4" />
              By Client
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(SERVICE_CATEGORIES).map(([key, cat]) => (
                  <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <h2 className="text-lg font-semibold">
              {format(startOfWeek(currentDate), 'MMM d')} - {format(endOfWeek(currentDate), 'MMM d, yyyy')}
            </h2>
          </div>

          <Button variant="outline" size="sm" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-muted/30 rounded-lg">
          {Object.entries(SERVICE_CATEGORIES).map(([key, cat]) => (
            <div key={key} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-sm">{cat.name}</span>
            </div>
          ))}
        </div>

        {/* View Content */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {scheduleView === "timeline" && <TimelineView />}
            {scheduleView === "density" && <DensityGridView />}
            {scheduleView === "caregiver" && <ByCaregiverView />}
            {scheduleView === "client" && <ByClientView />}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Shifts</div>
              <div className="text-2xl font-bold">{totalShifts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Assigned</div>
              <div className="text-2xl font-bold text-green-600">{assignedShifts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Unassigned</div>
              <div className="text-2xl font-bold text-orange-600">{unassignedShifts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Active Caregivers</div>
              <div className="text-2xl font-bold text-blue-600">{activeCaregivers}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ShiftDetailsDialog
        shift={selectedShift}
        open={!!selectedShift}
        onOpenChange={(open) => !open && setSelectedShift(null)}
      />
    </div>
  );
};

export default Schedule;
