import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
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
  Zap,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { toast } from "sonner";
import { ShiftDetailsDialog } from "@/components/schedule/ShiftDetailsDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";

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
  const [isAddShiftDialogOpen, setIsAddShiftDialogOpen] = useState(false);
  const [selectedClientForShift, setSelectedClientForShift] = useState<any>(null);
  const [shiftStep, setShiftStep] = useState(1);
  const [shiftData, setShiftData] = useState({
    primaryService: null as any,
    additionalService: null as any,
    client_id: "",
    duration: 0,
    day: null as number | null,
    repeat: "once" as "once" | "weekly" | "biweekly" | "monthly",
    caregiver: null as any,
    time: "",
    startDate: "",
    rate: 35,
  });
  const [availableCaregiversForShift, setAvailableCaregiversForShift] = useState<any[]>([]);
  const [loadingCaregiversForShift, setLoadingCaregiversForShift] = useState(false);
  const [clientCareTypesForShift, setClientCareTypesForShift] = useState<any[]>([]);
  const [loadingClientCareTypesForShift, setLoadingClientCareTypesForShift] = useState(false);

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
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);
      await fetchScheduleData(profileData.agency_id);
    }
  };

  const fetchScheduleData = async (agencyId: string) => {
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
        .eq("agency_id", agencyId)
        .gte("shift_date", format(startDate, "yyyy-MM-dd"))
        .lte("shift_date", format(endDate, "yyyy-MM-dd"))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setShifts(shiftsData || []);

      // Fetch shift assignments
      if (shiftsData) {
        const shiftIds = shiftsData.map((s) => s.id);
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
        .eq("agency_id", agencyId)
        .eq("is_active", true);
      setCaregivers(caregiversData || []);

      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("*")
        .eq("agency_id", agencyId);
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
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

  const loadClientCareTypesForShift = async (clientId: string) => {
    setLoadingClientCareTypesForShift(true);
    try {
      const { data: careNeeds, error } = await supabase
        .from("client_care_needs")
        .select(`
          care_type_code,
          care_types:care_type_code (
            id,
            code,
            name,
            category,
            description,
            keywords,
            price,
            duration_hours
          )
        `)
        .eq("client_id", clientId);

      if (error) throw error;

      const types = careNeeds?.map((cn: any) => ({
        ...cn.care_types,
        care_type_code: cn.care_type_code
      })) || [];
      
      setClientCareTypesForShift(types);
      
      if (types.length === 0) {
        toast.info("This client has no care types configured. Showing all available services.");
        setClientCareTypesForShift(careTypes);
      }
    } catch (error: any) {
      toast.error("Failed to load client care types");
      console.error(error);
      setClientCareTypesForShift(careTypes);
    } finally {
      setLoadingClientCareTypesForShift(false);
    }
  };

  const loadAvailableCaregiversForShift = async () => {
    if (!shiftData.client_id || shiftData.day === null) return;

    setLoadingCaregiversForShift(true);
    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("zip_code")
        .eq("id", shiftData.client_id)
        .maybeSingle();

      if (!clientData?.zip_code) {
        toast.error("Client zip code not found");
        return;
      }

      const { data: caregiversData } = await supabase
        .from("caregivers")
        .select(`
          id, first_name, last_name, hourly_rate, performance_rating,
          service_zipcodes,
          caregiver_availability(day_of_week, start_time, end_time, is_available)
        `)
        .eq("is_active", true);

      const filtered = (caregiversData || [])
        .filter((cg) => {
          const serviceZipcodes = cg.service_zipcodes || [];
          if (!serviceZipcodes.includes(clientData.zip_code)) return false;
          
          const daySlot = cg.caregiver_availability?.find(
            (slot: any) => slot.day_of_week === shiftData.day && slot.is_available
          );
          return !!daySlot;
        })
        .sort((a, b) => (b.performance_rating || 0) - (a.performance_rating || 0));

      setAvailableCaregiversForShift(filtered);
      if (filtered.length === 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        toast.info(`No caregivers available on ${dayNames[shiftData.day]}`);
      }
    } catch (error: any) {
      toast.error("Failed to fetch caregivers");
    } finally {
      setLoadingCaregiversForShift(false);
    }
  };

  const handleCloseShiftDialog = () => {
    setIsAddShiftDialogOpen(false);
    setSelectedClientForShift(null);
    setShiftStep(1);
    setShiftData({
      primaryService: null,
      additionalService: null,
      client_id: "",
      duration: 0,
      day: null,
      repeat: "once",
      caregiver: null,
      time: "",
      startDate: "",
      rate: 35,
    });
    setAvailableCaregiversForShift([]);
    setClientCareTypesForShift([]);
  };

  const handleSaveShift = async () => {
    if (!shiftData.client_id || !shiftData.primaryService || !shiftData.caregiver ||
        !shiftData.time || shiftData.day === null || !shiftData.startDate) {
      toast.error("Please complete all required fields");
      return;
    }

    try {
      const start = shiftData.startDate;
      let end = new Date(start);
      
      if (shiftData.repeat === 'weekly') {
        end.setMonth(end.getMonth() + 3);
      } else if (shiftData.repeat === 'biweekly') {
        end.setMonth(end.getMonth() + 6);
      } else if (shiftData.repeat === 'monthly') {
        end.setMonth(end.getMonth() + 12);
      } else {
        end = new Date(start);
      }

      const shiftsToCreate = [];
      const [timeValue, period] = shiftData.time.split(' ');
      let [hours] = timeValue.split(':').map(Number);
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      const startTimeHours = hours;
      const endTimeHours = hours + shiftData.duration;
      const startTime = `${String(startTimeHours).padStart(2, '0')}:00`;
      const endTime = `${String(endTimeHours % 24).padStart(2, '0')}:00`;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === shiftData.day) {
          const shiftDate = d.toISOString().split('T')[0];
          shiftsToCreate.push({
            client_id: shiftData.client_id,
            agency_id: user.id,
            caregiver_id: shiftData.caregiver.id,
            shift_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            duration_hours: shiftData.duration,
            care_type_code: shiftData.primaryService.code,
            status: 'open',
            special_notes: shiftData.additionalService
              ? `Includes ${shiftData.additionalService.name}`
              : null,
            order_title: shiftData.primaryService.name
          });
        }
      }

      const { error: shiftsError } = await supabase.from("shifts").insert(shiftsToCreate);
      if (shiftsError) throw shiftsError;

      toast.success("Shift(s) created successfully");
      handleCloseShiftDialog();
      if (user) fetchScheduleData(user.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to create shift");
      console.error(error);
    }
  };

  const getServiceIcon = (category: string) => {
    const iconMap: Record<string, string> = {
      'Activities of Daily Living (ADL)': '🛁',
      'Instrumental Activities of Daily Living (IADL)': '🏠',
      'Health Monitoring & Care': '❤️',
      'Cognitive & Emotional Support': '🧠',
      'Safety & Transportation': '🚗',
      'Specialized Care': '⚕️',
    };
    return iconMap[category] || '💼';
  };

  useEffect(() => {
    if (shiftStep === 2 && shiftData.day !== null) {
      loadAvailableCaregiversForShift();
    }
  }, [shiftStep, shiftData.day]);

  useEffect(() => {
    if (shiftData.client_id && isAddShiftDialogOpen) {
      loadClientCareTypesForShift(shiftData.client_id);
    }
  }, [shiftData.client_id, isAddShiftDialogOpen]);

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
            {/* Add row for unassigned shifts */}
            <tr className="border-t bg-muted/30">
              <td className="p-4 font-medium sticky left-0 bg-muted/30">
                <div>
                  <div className="font-semibold text-warning">Unassigned Shifts</div>
                  <div className="text-sm text-muted-foreground">Need assignment</div>
                </div>
              </td>
              {timeSlots.map(time => {
                const unassignedShifts = filteredShifts.filter(s => 
                  !s.caregiver_id && 
                  s.start_time.startsWith(time.split(':')[0])
                );

                return (
                  <td key={time} className="p-2">
                    {unassignedShifts.map(shift => {
                      const category = getCategoryForShift(shift);
                      return (
                        <div 
                          key={shift.id}
                          className="rounded-lg p-2 text-xs mb-1 cursor-pointer hover:shadow-lg transition-all border-2 border-dashed border-warning/50"
                          style={{ backgroundColor: `${category.color}88` }}
                          onClick={() => navigate(`/quick-assign?shift=${shift.id}`)}
                        >
                          <div className="font-semibold flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {shift.clients?.first_name}
                          </div>
                          <div className="opacity-90">{shift.care_types?.name}</div>
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>

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
                                className="rounded p-1 text-xs text-white cursor-pointer hover:shadow-md transition-all group relative"
                                style={{ backgroundColor: category.color }}
                                onClick={() => setSelectedShift(shift)}
                              >
                                <div className="font-medium flex items-center justify-between">
                                  {shift.start_time}
                                </div>
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
      
      {/* Unassigned Shifts Section */}
      {filteredShifts.filter(s => !s.caregiver_id).length > 0 && (
        <Card className="border-dashed border-2 border-warning bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Unassigned Shifts
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredShifts.filter(s => !s.caregiver_id).length} shifts need caregivers
                </p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(day => {
                const unassignedDayShifts = filteredShifts.filter(s => 
                  !s.caregiver_id && isSameDay(new Date(s.shift_date), day)
                );

                return (
                  <div key={day.toISOString()} className="border rounded-lg p-2 min-h-[100px] bg-background">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      {format(day, 'EEE d')}
                    </div>

                    {unassignedDayShifts.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">-</div>
                    ) : (
                      <div className="space-y-1">
                        {unassignedDayShifts.map(shift => {
                          const category = getCategoryForShift(shift);

                          return (
                            <div 
                              key={shift.id}
                              className="rounded p-1 text-xs text-white cursor-pointer hover:shadow-md transition-all border border-dashed border-warning"
                              style={{ backgroundColor: category.color }}
                              onClick={() => navigate(`/quick-assign?shift=${shift.id}`)}
                            >
                              <div className="font-medium flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {shift.start_time}
                              </div>
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
      )}
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

                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => {
                    setSelectedClientForShift(client);
                    setShiftData(prev => ({ ...prev, client_id: client.id }));
                    setIsAddShiftDialogOpen(true);
                    setShiftStep(1);
                    loadClientCareTypesForShift(client.id);
                  }}
                >
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
                                className="rounded p-1 text-xs text-white cursor-pointer hover:shadow-md transition-all group relative"
                                style={{ backgroundColor: category.color }}
                                onClick={() => setSelectedShift(shift)}
                              >
                                <div className="font-medium flex items-center justify-between">
                                  {shift.start_time}
                                  {!caregiver && (
                                    <Zap className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/quick-assign?shift=${shift.id}`);
                                      }}
                                    />
                                  )}
                                </div>
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
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Schedule Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage shifts and caregiver assignments
          </p>
        </div>
        {/* View Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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

      {/* Add Shift Dialog */}
      <Dialog open={isAddShiftDialogOpen} onOpenChange={setIsAddShiftDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div>
              <DialogTitle>Add Shift for {selectedClientForShift?.first_name} {selectedClientForShift?.last_name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Step {shiftStep} of 3</p>
            </div>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all ${
                shiftStep >= 1 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'
              }`}>1</div>
              <div className={`h-1 w-12 transition-all ${shiftStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all ${
                shiftStep >= 2 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'
              }`}>2</div>
              <div className={`h-1 w-12 transition-all ${shiftStep >= 3 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all ${
                shiftStep >= 3 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'
              }`}>3</div>
            </div>
          </div>

          {/* Step 1: Select Service */}
          {shiftStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Select Primary Care Service</h3>
                <p className="text-sm text-muted-foreground">
                  {clientCareTypesForShift.length > 0 
                    ? "Services configured for this client" 
                    : loadingClientCareTypesForShift 
                    ? "Loading client services..." 
                    : "Choose the main care service"}
                </p>
              </div>
              
              {loadingClientCareTypesForShift ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                  {clientCareTypesForShift
                    .filter(s => s.category === 'Activities of Daily Living (ADL)' ||
                                 s.category === 'Health Monitoring & Care' ||
                                 s.category === 'Instrumental Activities of Daily Living (IADL)')
                    .map((service) => (
                    <Card
                      key={service.id}
                      className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                        shiftData.primaryService?.id === service.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setShiftData(prev => ({ 
                        ...prev, 
                        primaryService: service,
                        duration: service.duration_hours || 4,
                        rate: service.price || 35
                      }))}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl flex-shrink-0">
                            {getServiceIcon(service.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-base">{service.name}</h4>
                              <Badge variant="secondary" className="shrink-0">${service.price}/hr</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {service.description || service.keywords}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {shiftData.primaryService && (
                <div className="border-t pt-6">
                  <h4 className="text-lg font-semibold mb-3">Add Another Service? (Optional)</h4>
                  <div className="grid gap-3 max-h-[200px] overflow-y-auto">
                    {clientCareTypesForShift
                      .filter(s => s.code !== shiftData.primaryService?.code)
                      .slice(0, 5)
                      .map((service) => (
                      <Card
                        key={service.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          shiftData.additionalService?.id === service.id
                            ? 'border-primary bg-primary/5 ring-2 ring-primary'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => {
                          if (shiftData.additionalService?.id === service.id) {
                            setShiftData(prev => ({ 
                              ...prev, 
                              additionalService: null,
                              duration: prev.primaryService?.duration_hours || 4,
                              rate: prev.primaryService?.price || 35
                            }));
                          } else {
                            const primaryDuration = shiftData.primaryService?.duration_hours || 4;
                            const additionalDuration = service.duration_hours || 4;
                            const totalDuration = primaryDuration + additionalDuration;
                            const totalRate = (shiftData.primaryService?.price || 35) + (service.price || 35);
                            setShiftData(prev => ({ 
                              ...prev, 
                              additionalService: service,
                              duration: totalDuration,
                              rate: totalRate / 2
                            }));
                          }
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{service.name}</span>
                            <Badge variant="secondary">${service.price}/hr</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseShiftDialog}>Cancel</Button>
                <Button 
                  onClick={() => setShiftStep(2)}
                  disabled={!shiftData.primaryService}
                >
                  Next: Schedule
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Schedule Details */}
          {shiftStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Schedule & Caregiver</h3>
                <p className="text-sm text-muted-foreground">Choose day, time, and select a caregiver</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Select Day *</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <Button
                        key={day}
                        variant={shiftData.day === index ? "default" : "outline"}
                        onClick={() => setShiftData(prev => ({ ...prev, day: index, caregiver: null, time: '' }))}
                        className="text-xs"
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>

                {shiftData.day !== null && (
                  <>
                    <div>
                      <Label>Select Caregiver *</Label>
                      {loadingCaregiversForShift ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : availableCaregiversForShift.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No caregivers available on {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][shiftData.day]}
                        </div>
                      ) : (
                        <div className="grid gap-2 max-h-[250px] overflow-y-auto">
                          {availableCaregiversForShift.map((cg) => (
                            <Card
                              key={cg.id}
                              className={`cursor-pointer transition-all ${
                                shiftData.caregiver?.id === cg.id
                                  ? 'border-primary bg-primary/5 ring-2 ring-primary'
                                  : 'hover:border-primary/50'
                              }`}
                              onClick={() => setShiftData(prev => ({ ...prev, caregiver: cg, time: '' }))}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                      {cg.first_name[0]}{cg.last_name[0]}
                                    </div>
                                    <div>
                                      <div className="font-medium">{cg.first_name} {cg.last_name}</div>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                        {cg.performance_rating || 5.0}
                                      </div>
                                    </div>
                                  </div>
                                  <Badge variant="secondary">${cg.hourly_rate}/hr</Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {shiftData.caregiver && (
                      <>
                        <div>
                          <Label>Select Time *</Label>
                          <div className="space-y-3">
                            {[
                              { period: 'morning', slots: ['6:00', '7:00', '8:00', '9:00', '10:00'] },
                              { period: 'afternoon', slots: ['12:00', '1:00', '2:00', '3:00', '4:00'] },
                              { period: 'evening', slots: ['6:00', '7:00', '8:00'] }
                            ].map(({ period, slots }) => (
                              <div key={period}>
                                <div className="text-sm font-medium capitalize mb-2">{period}</div>
                                <div className="grid grid-cols-5 gap-2">
                                  {slots.map((time) => (
                                    <Button
                                      key={time}
                                      variant={shiftData.time === `${time} ${period.toUpperCase()}` ? "default" : "outline"}
                                      onClick={() => setShiftData(prev => ({ 
                                        ...prev, 
                                        time: `${time} ${period.toUpperCase()}`,
                                        rate: prev.caregiver?.hourly_rate || 35
                                      }))}
                                      className="text-xs"
                                    >
                                      {time}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label>Schedule *</Label>
                          <RadioGroup 
                            value={shiftData.repeat}
                            onValueChange={(value: any) => setShiftData(prev => ({ ...prev, repeat: value }))}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="once" id="shift-once" />
                              <Label htmlFor="shift-once" className="cursor-pointer">One Time Only</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="weekly" id="shift-weekly" />
                              <Label htmlFor="shift-weekly" className="cursor-pointer">Weekly (3 months)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="biweekly" id="shift-biweekly" />
                              <Label htmlFor="shift-biweekly" className="cursor-pointer">Bi-weekly (6 months)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="monthly" id="shift-monthly" />
                              <Label htmlFor="shift-monthly" className="cursor-pointer">Monthly (12 months)</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div>
                          <Label>Start Date *</Label>
                          <Input
                            type="date"
                            value={shiftData.startDate}
                            onChange={(e) => setShiftData(prev => ({ ...prev, startDate: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setShiftStep(1)}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCloseShiftDialog}>Cancel</Button>
                  <Button 
                    onClick={() => setShiftStep(3)}
                    disabled={!shiftData.caregiver || !shiftData.time || !shiftData.startDate}
                  >
                    Next: Review
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {shiftStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Review & Confirm</h3>
                <p className="text-sm text-muted-foreground">Please review your shift details before creating</p>
              </div>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Client</Label>
                      <p className="font-medium">{selectedClientForShift?.first_name} {selectedClientForShift?.last_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Primary Service</Label>
                      <p className="font-medium">{shiftData.primaryService?.name}</p>
                    </div>
                    {shiftData.additionalService && (
                      <div>
                        <Label className="text-muted-foreground">Additional Service</Label>
                        <p className="font-medium">{shiftData.additionalService?.name}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-muted-foreground">Caregiver</Label>
                      <p className="font-medium">{shiftData.caregiver?.first_name} {shiftData.caregiver?.last_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Day</Label>
                      <p className="font-medium">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][shiftData.day!]}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Time</Label>
                      <p className="font-medium">{shiftData.time}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Duration</Label>
                      <p className="font-medium">{shiftData.duration} hours</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Schedule</Label>
                      <p className="font-medium capitalize">{shiftData.repeat}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Start Date</Label>
                      <p className="font-medium">{new Date(shiftData.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rate</Label>
                      <p className="font-medium">${shiftData.rate}/hr</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setShiftStep(2)}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCloseShiftDialog}>Cancel</Button>
                  <Button onClick={handleSaveShift}>
                    Create Shift
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Schedule;
