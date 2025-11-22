import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, MapPin, DollarSign, Filter, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ShiftDetailsDialog } from "@/components/schedule/ShiftDetailsDialog";
import { AppLayout } from "@/components/AppLayout";

interface OpenShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  care_type_code: string;
  pay_rate: number | null;
  ai_match_score: number | null;
  special_instructions: string | null;
  clients: {
    first_name: string;
    last_name: string;
    city: string;
    address: string;
  };
}

const AvailableShifts = () => {
  const [shifts, setShifts] = useState<OpenShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selectedShift, setSelectedShift] = useState<any>(null);

  useEffect(() => {
    fetchCaregiverAndShifts();
  }, []);

  const fetchCaregiverAndShifts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to view shifts");
        return;
      }

      // Get caregiver ID
      const { data: caregiverData } = await supabase
        .from("caregivers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (caregiverData) {
        setCaregiverId(caregiverData.id);
      }

      // Fetch open shifts
      const { data: shiftsData, error } = await supabase
        .from("shifts")
        .select(`
          *,
          clients (first_name, last_name, city, address)
        `)
        .eq("status", "open")
        .gte("shift_date", format(new Date(), "yyyy-MM-dd"))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setShifts(shiftsData || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  const handlePickUpShift = async (shiftId: string) => {
    if (!caregiverId) {
      toast.error("Caregiver profile not found");
      return;
    }

    if (!shiftId) {
      toast.error("Invalid shift");
      return;
    }

    try {
      // Create assignment
      const { error: assignError } = await supabase
        .from("shift_assignments")
        .insert({
          shift_id: shiftId,
          caregiver_id: caregiverId,
          status: "scheduled",
          assignment_method: "picked_up"
        });

      if (assignError) throw assignError;

      // Update shift status
      const { error: updateError } = await supabase
        .from("shifts")
        .update({ 
          status: "assigned",
          caregiver_id: caregiverId 
        })
        .eq("id", shiftId);

      if (updateError) throw updateError;

      toast.success("Shift picked up successfully!");
      fetchCaregiverAndShifts();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to pick up shift");
    }
  };

  const getCareTypeLabel = (code: string) => {
    return code.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getMatchScoreColor = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score >= 80) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (score >= 60) return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    return "bg-orange-500/10 text-orange-600 border-orange-500/20";
  };

  const filteredShifts = shifts.filter(shift => {
    if (!shift.clients) return false;
    
    const matchesSearch = 
      shift.clients.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shift.clients.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shift.clients.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCareTypeLabel(shift.care_type_code).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !filterDate || shift.shift_date === filterDate;
    
    return matchesSearch && matchesDate;
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-120px)]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div>
        <h1 className="text-3xl font-bold mb-2">Available Shifts</h1>
        <p className="text-muted-foreground mb-6">
          Pick up extra shifts to increase your earnings
        </p>
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by client, location, or care type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shift Count */}
        <div className="mb-4">
          <p className="text-muted-foreground">
            {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''} available
          </p>
        </div>

        {/* Shifts Grid */}
        {filteredShifts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No shifts available</h3>
              <p className="text-muted-foreground">
                {searchTerm || filterDate 
                  ? "Try adjusting your filters" 
                  : "Check back later for new opportunities"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredShifts.map((shift) => (
              <Card 
                key={shift.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedShift(shift)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">
                          {shift.clients.first_name} {shift.clients.last_name}
                        </h3>
                        {shift.ai_match_score && (
                          <Badge className={getMatchScoreColor(shift.ai_match_score)}>
                            {shift.ai_match_score}% Match
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="mb-3">
                        {getCareTypeLabel(shift.care_type_code)}
                      </Badge>
                    </div>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePickUpShift(shift.id);
                      }}
                    >
                      Pick Up Shift
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(shift.shift_date), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{shift.clients.city}</span>
                    </div>
                    {shift.pay_rate && (
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <DollarSign className="w-4 h-4" />
                        <span>${shift.pay_rate}/hr · ${(shift.pay_rate * shift.duration_hours).toFixed(2)} total</span>
                      </div>
                    )}
                  </div>

                  {shift.special_instructions && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        <strong>Special Instructions:</strong> {shift.special_instructions}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ShiftDetailsDialog
          shift={selectedShift}
          open={!!selectedShift}
          onOpenChange={(open) => !open && setSelectedShift(null)}
        />
      </div>
    </AppLayout>
  );
};

export default AvailableShifts;
