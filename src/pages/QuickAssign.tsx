import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Star, AlertCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface OpenShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  care_type: string;
  clients: {
    first_name: string;
    last_name: string;
    city: string;
  };
}

interface Caregiver {
  id: string;
  first_name: string;
  last_name: string;
  performance_rating: number;
  availability: any;
  skills: string[];
}

const QuickAssign = () => {
  const navigate = useNavigate();
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [draggedShift, setDraggedShift] = useState<OpenShift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    await fetchData(user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      setLoading(true);

      const [shiftsResult, caregiversResult] = await Promise.all([
        supabase
          .from("shifts")
          .select(`
            *,
            clients (first_name, last_name, city)
          `)
          .eq("agency_id", userId)
          .eq("status", "open")
          .order("shift_date", { ascending: true })
          .limit(10),
        
        supabase
          .from("caregivers")
          .select("*")
          .eq("agency_id", userId)
          .eq("is_active", true)
          .order("performance_rating", { ascending: false })
      ]);

      if (shiftsResult.error) throw shiftsResult.error;
      if (caregiversResult.error) throw caregiversResult.error;

      setOpenShifts(shiftsResult.data || []);
      setCaregivers(caregiversResult.data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (shift: OpenShift) => {
    setDraggedShift(shift);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (caregiverId: string) => {
    if (!draggedShift) return;

    try {
      const { error: assignError } = await supabase
        .from("shift_assignments")
        .insert({
          shift_id: draggedShift.id,
          caregiver_id: caregiverId,
          status: "scheduled",
          assignment_method: "manual"
        });

      if (assignError) throw assignError;

      const { error: updateError } = await supabase
        .from("shifts")
        .update({ status: "assigned" })
        .eq("id", draggedShift.id);

      if (updateError) throw updateError;

      toast.success("Shift assigned successfully!");
      setDraggedShift(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) fetchData(user.id);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to assign shift");
    }
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
              <h1 className="text-2xl font-bold text-primary">CareMuch - Quick Assign</h1>
              <p className="text-sm text-muted-foreground">Drag & Drop Shift Assignment</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-[calc(100vh-120px)]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Open Shifts Column */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-warning" />
                    Open Shifts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                  {openShifts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No open shifts</p>
                  ) : (
                    openShifts.map((shift) => (
                      <Card
                        key={shift.id}
                        draggable
                        onDragStart={() => handleDragStart(shift)}
                        className={`cursor-move hover:shadow-lg transition-all ${
                          draggedShift?.id === shift.id ? "opacity-50" : ""
                        }`}
                      >
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold">
                                {shift.clients?.first_name} {shift.clients?.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {shift.clients?.city}
                              </p>
                            </div>
                            <Badge className={getCareTypeColor(shift.care_type)}>
                              {shift.care_type.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>
                                {format(new Date(shift.shift_date), "MMM d")} •{" "}
                                {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Available Caregivers Column */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    Caregivers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                  {caregivers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No available caregivers</p>
                  ) : (
                    caregivers.map((caregiver) => (
                      <div
                        key={caregiver.id}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(caregiver.id)}
                        className={`p-4 rounded-lg border transition-all ${
                          draggedShift
                            ? "border-primary/50 bg-primary/5 border-dashed border-2"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">
                              {caregiver.first_name} {caregiver.last_name}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < Math.floor(caregiver.performance_rating)
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                              <span className="text-sm text-muted-foreground ml-1">
                                {caregiver.performance_rating.toFixed(1)}
                              </span>
                            </div>
                            {caregiver.skills && caregiver.skills.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Available: {caregiver.skills.slice(0, 3).join(", ")}
                              </p>
                            )}
                          </div>
                          {draggedShift && (
                            <div className="text-sm text-success font-medium">
                              Drop here →
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* AI Suggestion Section */}
          {openShifts.length > 0 && (
            <Card className="mt-6 bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">AI Suggestion:</p>
                  <p className="text-sm text-muted-foreground">
                    Try using Auto-Assign for optimal matches based on skills, location, and availability
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/unassigned-shifts")}
                    className="ml-auto"
                  >
                    View Auto-Assign
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default QuickAssign;
