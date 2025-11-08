import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Zap, CheckCircle, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/AppLayout";

const AutoSchedule = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [openShifts, setOpenShifts] = useState<any[]>([]);
  const [schedulingResults, setSchedulingResults] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("next");

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
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        fetchOpenShifts(session.user.id);
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

  const getWeekDateRange = (weekType: string) => {
    const now = new Date();
    const currentDay = now.getDay();
    const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay) % 7 || 7;
    
    const startDate = new Date(now);
    if (weekType === "next") {
      startDate.setDate(now.getDate() + daysUntilMonday);
    } else {
      startDate.setDate(now.getDate() + daysUntilMonday + 7);
    }
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
  };

  const fetchOpenShifts = async (userId: string) => {
    const { startDate, endDate } = getWeekDateRange(selectedWeek);

    const { data, error } = await supabase
      .from("shifts")
      .select(`
        *,
        clients(first_name, last_name, city, care_requirements, medical_conditions),
        client_orders!inner(order_number)
      `)
      .eq("agency_id", userId)
      .eq("status", "open")
      .gte("shift_date", startDate.toISOString().split("T")[0])
      .lte("shift_date", endDate.toISOString().split("T")[0])
      .order("shift_date", { ascending: true });

    if (error) {
      console.error("Error fetching open shifts:", error);
      toast.error("Failed to load open shifts");
    } else {
      setOpenShifts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchOpenShifts(user.id);
    }
  }, [selectedWeek, user]);

  const handleAutoSchedule = async () => {
    if (openShifts.length === 0) {
      toast.error("No open shifts to schedule");
      return;
    }

    setIsScheduling(true);
    const results: any[] = [];

    try {
      // Process each shift
      for (const shift of openShifts) {
        // Fetch available caregivers with skills and availability
        const { data: caregivers, error: caregiversError } = await supabase
          .from("caregivers")
          .select(`
            *,
            caregiver_skills(care_type_code, proficiency_level, years_experience),
            caregiver_availability(day_of_week, start_time, end_time, is_available)
          `)
          .eq("agency_id", user.id)
          .eq("is_active", true);

        if (caregiversError) {
          console.error("Error fetching caregivers:", caregiversError);
          results.push({
            shift,
            status: "error",
            message: "Failed to fetch caregivers",
          });
          continue;
        }

        // Filter caregivers based on:
        // 1. Skills match
        // 2. Availability match
        const shiftDate = new Date(shift.shift_date);
        const shiftDay = shiftDate.getDay();
        const shiftStart = shift.start_time;
        const shiftEnd = shift.end_time;

        const matchedCaregivers = caregivers?.filter((caregiver) => {
          // Check skill match
          const hasSkill = caregiver.caregiver_skills?.some(
            (skill: any) => skill.care_type_code === shift.care_type_code
          );
          if (!hasSkill) return false;

          // Check availability
          const availability = caregiver.caregiver_availability?.find(
            (avail: any) => avail.day_of_week === shiftDay && avail.is_available
          );
          
          if (!availability) return false;

          // Check time overlap
          const availStart = availability.start_time;
          const availEnd = availability.end_time;
          
          const isTimeMatch = shiftStart >= availStart && shiftEnd <= availEnd;
          
          return isTimeMatch;
        });

        if (matchedCaregivers && matchedCaregivers.length > 0) {
          // Sort by performance rating and reliability
          matchedCaregivers.sort((a, b) => {
            const scoreA = (a.performance_rating || 0) * 0.6 + (a.reliability_score || 0) * 0.4;
            const scoreB = (b.performance_rating || 0) * 0.6 + (b.reliability_score || 0) * 0.4;
            return scoreB - scoreA;
          });

          const bestMatch = matchedCaregivers[0];

          // Assign the shift
          const { error: assignError } = await supabase
            .from("shifts")
            .update({
              caregiver_id: bestMatch.id,
              status: "assigned",
            })
            .eq("id", shift.id);

          if (assignError) {
            results.push({
              shift,
              status: "error",
              message: "Failed to assign caregiver",
            });
          } else {
            results.push({
              shift,
              status: "success",
              caregiver: bestMatch,
              message: `Assigned to ${bestMatch.first_name} ${bestMatch.last_name}`,
            });
          }
        } else {
          results.push({
            shift,
            status: "no_match",
            message: "No suitable caregiver found",
          });
        }
      }

      setSchedulingResults(results);
      
      const successCount = results.filter((r) => r.status === "success").length;
      const failCount = results.filter((r) => r.status !== "success").length;
      
      if (successCount > 0) {
        toast.success(`Successfully scheduled ${successCount} shift(s)`);
      }
      if (failCount > 0) {
        toast.warning(`${failCount} shift(s) could not be scheduled`);
      }

      // Refresh open shifts
      if (user) fetchOpenShifts(user.id);
    } catch (error) {
      console.error("Error in auto-scheduling:", error);
      toast.error("Auto-scheduling failed");
    } finally {
      setIsScheduling(false);
    }
  };

  const { startDate, endDate } = getWeekDateRange(selectedWeek);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading schedule data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8" />
            Auto Schedule
          </h2>
          <p className="text-muted-foreground">
            Automatically assign caregivers to open shifts based on skills and availability
          </p>
        </div>

        {/* Week Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-sm font-medium">Select Week</Label>
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-full sm:w-[300px] mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="next">
                      Next Week ({startDate.toLocaleDateString()} - {endDate.toLocaleDateString()})
                    </SelectItem>
                    <SelectItem value="following">
                      Following Week
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Shifts</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openShifts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Unassigned shifts this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Successfully Scheduled</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {schedulingResults.filter((r) => r.status === "success").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Assigned caregivers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Not Scheduled</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {schedulingResults.filter((r) => r.status !== "success").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                No match found
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Button */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Ready to Auto-Schedule?</h3>
                <p className="text-sm text-muted-foreground">
                  This will automatically assign the best-matched caregivers to all open shifts
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleAutoSchedule}
                disabled={isScheduling || openShifts.length === 0}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                {isScheduling ? "Scheduling..." : "Run Auto-Schedule"}
              </Button>
            </div>
            {isScheduling && (
              <div className="mt-4">
                <Progress value={66} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">
                  Processing shifts and matching caregivers...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Shifts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Open Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {openShifts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No open shifts for the selected week</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Care Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openShifts.map((shift) => {
                      const result = schedulingResults.find((r) => r.shift.id === shift.id);
                      
                      return (
                        <TableRow key={shift.id}>
                          <TableCell>{new Date(shift.shift_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {shift.start_time} - {shift.end_time}
                          </TableCell>
                          <TableCell>
                            {shift.clients?.first_name} {shift.clients?.last_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{shift.care_type_code}</Badge>
                          </TableCell>
                          <TableCell>{shift.clients?.city || "N/A"}</TableCell>
                          <TableCell>
                            {result ? (
                              <Badge
                                variant={
                                  result.status === "success"
                                    ? "default"
                                    : result.status === "error"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {result.message}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AutoSchedule;
