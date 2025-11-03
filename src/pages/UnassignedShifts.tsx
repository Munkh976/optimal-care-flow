import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, AlertCircle, Sparkles } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, subWeeks, subMonths, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface UnassignedShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  care_type: string;
  status: string;
  clients: {
    first_name: string;
    last_name: string;
    address: string;
    city: string;
    care_requirements: string[];
  };
}

interface CaregiverMatch {
  caregiver_id: string;
  match_score: number;
  key_factors: string[];
  warnings?: string[];
  distance_miles?: number;
  caregiver: {
    id: string;
    first_name: string;
    last_name: string;
    performance_rating: number;
    reliability_score: number;
    hourly_rate: number;
    city: string;
    caregiver_skills?: Array<{
      care_type_code: string;
    }>;
  };
}

const UnassignedShifts = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<UnassignedShift[]>([]);
  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<UnassignedShift | null>(null);
  const [matches, setMatches] = useState<CaregiverMatch[]>([]);
  const [matchingProgress, setMatchingProgress] = useState(0);
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    checkAuthAndFetch();
  }, [currentDate, view]);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchUnassignedShifts(user.id);
  };

  const fetchUnassignedShifts = async (userId: string) => {
    try {
      setLoading(true);
      
      const startDate = view === "week" 
        ? startOfWeek(currentDate)
        : startOfMonth(currentDate);
      
      const endDate = view === "week"
        ? endOfWeek(currentDate)
        : endOfMonth(currentDate);

      const { data, error } = await supabase
        .from("shifts")
        .select(`
          *,
          clients (
            first_name,
            last_name,
            address,
            city,
            care_requirements
          )
        `)
        .eq("agency_id", userId)
        .eq("status", "open")
        .gte("shift_date", format(startDate, "yyyy-MM-dd"))
        .lte("shift_date", format(endDate, "yyyy-MM-dd"))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load unassigned shifts");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = async (shift: UnassignedShift) => {
    setSelectedShift(shift);
    setIsMatching(true);
    setMatchingProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setMatchingProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const { data, error } = await supabase.functions.invoke('match-caregiver', {
        body: { shiftId: shift.id }
      });

      clearInterval(progressInterval);
      setMatchingProgress(100);

      if (error) throw error;
      
      setMatches(data.matches);
      setIsMatching(false);
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Error:", error);
      toast.error("Failed to find matches");
      setIsMatching(false);
      setSelectedShift(null);
    }
  };

  const handleAssign = async (caregiverId: string) => {
    if (!selectedShift) return;

    try {
      const { error: assignError } = await supabase
        .from("shift_assignments")
        .insert({
          shift_id: selectedShift.id,
          caregiver_id: caregiverId,
          status: "scheduled",
          assignment_method: "auto_assigned"
        });

      if (assignError) throw assignError;

      const { error: updateError } = await supabase
        .from("shifts")
        .update({ status: "assigned" })
        .eq("id", selectedShift.id);

      if (updateError) throw updateError;

      toast.success("Shift assigned successfully!");
      setSelectedShift(null);
      setMatches([]);
      checkAuthAndFetch();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to assign shift");
    }
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

  const getShiftsForDay = (day: Date) => {
    return shifts.filter(shift => 
      isSameDay(new Date(shift.shift_date), day)
    );
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

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border/40 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Unassigned Shifts</h1>
              <p className="text-sm text-muted-foreground">
                {format(currentDate, view === "week" ? "'Week of' MMM d, yyyy" : "MMMM yyyy")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={view === "week" ? "default" : "outline"}
                onClick={() => setView("week")}
              >
                Week
              </Button>
              <Button
                variant={view === "month" ? "default" : "outline"}
                onClick={() => setView("month")}
              >
                Month
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (view === "week") {
                    setCurrentDate(subWeeks(currentDate, 1));
                  } else {
                    setCurrentDate(subMonths(currentDate, 1));
                  }
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (view === "week") {
                    setCurrentDate(addWeeks(currentDate, 1));
                  } else {
                    setCurrentDate(addMonths(currentDate, 1));
                  }
                }}
              >
                Next
              </Button>
              <Button onClick={() => navigate("/quick-assign")}>
                Quick Assign
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className={view === "week" ? "grid grid-cols-7 gap-4" : "grid grid-cols-7 gap-2"}>
            {getDaysInView().map((day, idx) => {
              const dayShifts = getShiftsForDay(day);
              const isCurrentDay = isToday(day);
              
              return (
                <div
                  key={idx}
                  className={`min-h-[200px] p-3 rounded-lg border ${
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
                    {dayShifts.map((shift) => (
                      <Card
                        key={shift.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleAutoMatch(shift)}
                      >
                        <CardContent className="p-3 space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-medium truncate">
                              {shift.clients?.first_name} {shift.clients?.last_name}
                            </p>
                            <AlertCircle className="w-3 h-3 text-warning flex-shrink-0" />
                          </div>
                          <Badge className={`text-xs ${getCareTypeColor(shift.care_type)}`}>
                            {shift.care_type.replace(/_/g, " ")}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{shift.start_time.slice(0, 5)}</span>
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
      </main>

      {/* Auto-Match Dialog */}
      <Dialog open={selectedShift !== null} onOpenChange={() => {
        setSelectedShift(null);
        setMatches([]);
        setIsMatching(false);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              CareMuch - Smart Match™
            </DialogTitle>
          </DialogHeader>

          {selectedShift && (
            <div className="space-y-6">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="font-semibold">FINDING BEST MATCH FOR:</p>
                <p className="text-sm">
                  Client: {selectedShift.clients?.first_name} {selectedShift.clients?.last_name}
                </p>
                <p className="text-sm">
                  Shift: {format(new Date(selectedShift.shift_date), "MMM d, yyyy")} • {selectedShift.start_time.slice(0, 5)} - {selectedShift.end_time.slice(0, 5)}
                </p>
                <p className="text-sm">Location: {selectedShift.clients?.city}</p>
              </div>

              {isMatching && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-sm font-medium">AI ANALYZING...</span>
                    <span className="ml-auto text-sm">{matchingProgress}%</span>
                  </div>
                  <Progress value={matchingProgress} className="h-2" />
                </div>
              )}

              {!isMatching && matches.length > 0 && (
                <div className="space-y-4">
                  <p className="font-semibold">TOP MATCHES:</p>
                  {matches.map((match, idx) => (
                    <Card key={match.caregiver_id} className="relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-bl-lg">
                        {idx + 1}
                      </div>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="text-lg font-semibold">
                              {match.caregiver.first_name} {match.caregiver.last_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-2xl font-bold text-success">
                                Match: {match.match_score}%
                              </span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={i < Math.floor(match.caregiver.performance_rating) ? "text-yellow-400" : "text-gray-300"}>
                                    ★
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button onClick={() => handleAssign(match.caregiver_id)} className="bg-success hover:bg-success/90">
                            ASSIGN →
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            {match.key_factors.map((factor, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <div className="w-4 h-4 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-success text-xs">✓</span>
                                </div>
                                <span>{factor}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            {match.warnings && match.warnings.length > 0 && (
                              <div className="space-y-2">
                                {match.warnings.map((warning, i) => (
                                  <div key={i} className="flex items-start gap-2 text-warning">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{warning}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnassignedShifts;
