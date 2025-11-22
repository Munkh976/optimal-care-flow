import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Star, AlertCircle, TrendingUp, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";

interface OpenShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  care_type_code: string;
  order_title: string;
  clients: {
    first_name: string;
    last_name: string;
    city: string;
    state: string;
    address: string;
    zip_code: string;
  };
}

interface MatchedCaregiver {
  caregiver_id: string;
  match_score: number;
  key_factors: {
    reasoning: string;
    warnings?: string[];
    distance_miles?: number;
  };
  caregiver?: {
    id: string;
    first_name: string;
    last_name: string;
    performance_rating: number;
    email: string;
  };
}

const QuickAssign = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shiftIdParam = searchParams.get("shift");
  
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [selectedShift, setSelectedShift] = useState<OpenShift | null>(null);
  const [matchedCaregivers, setMatchedCaregivers] = useState<MatchedCaregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

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

      // Get user's profile to fetch agency_id
      const { data: profileData } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", userId)
        .maybeSingle();

      if (!profileData?.agency_id) {
        toast.error("Profile not found");
        setLoading(false);
        return;
      }

      // First check if a specific shift was requested via URL
      let specificShift = null;
      if (shiftIdParam) {
        const specificShiftResult = await supabase
          .from("shifts")
          .select(`
            *,
            clients (first_name, last_name, city, address, state, zip_code)
          `)
          .eq("id", shiftIdParam)
          .single();
        
        if (specificShiftResult.data) {
          specificShift = specificShiftResult.data;
        }
      }

      // Fetch all open/unassigned shifts
      const shiftsResult = await supabase
        .from("shifts")
        .select(`
          *,
          clients (first_name, last_name, city, address, state, zip_code),
          shift_assignments(id)
        `)
        .eq("agency_id", profileData.agency_id)
        .in("status", ["open", "unassigned"])
        .order("shift_date", { ascending: true })
        .limit(50);

      if (shiftsResult.error) throw shiftsResult.error;

      // Filter to only truly unassigned shifts (no shift_assignments)
      const unassignedShifts = (shiftsResult.data || []).filter(
        shift => !shift.shift_assignments || shift.shift_assignments.length === 0
      );

      // If we have a specific shift from URL, make sure it's in the list
      let allShifts = unassignedShifts;
      if (specificShift && !allShifts.find(s => s.id === specificShift.id)) {
        allShifts = [specificShift, ...allShifts];
      }

      setOpenShifts(allShifts);

      // If shift ID provided, auto-select and fetch matches
      if (shiftIdParam && specificShift) {
        setSelectedShift(specificShift);
        await fetchMatchedCaregivers(shiftIdParam);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchedCaregivers = async (shiftId: string) => {
    try {
      setMatching(true);
      
      const { data, error } = await supabase.functions.invoke("match-caregiver", {
        body: { shiftId }
      });

      if (error) throw error;

      setMatchedCaregivers(data.matches || []);
    } catch (error) {
      console.error("Error fetching matches:", error);
      toast.error("Failed to fetch caregiver matches");
      setMatchedCaregivers([]);
    } finally {
      setMatching(false);
    }
  };

  const handleShiftSelect = async (shiftId: string) => {
    const shift = openShifts.find(s => s.id === shiftId);
    if (shift) {
      setSelectedShift(shift);
      await fetchMatchedCaregivers(shiftId);
    }
  };

  const handleAssignCaregiver = async (caregiverId: string) => {
    if (!selectedShift || !caregiverId) {
      toast.error("Missing required information");
      return;
    }

    try {
      // Create assignment
      const { error: assignError } = await supabase
        .from("shift_assignments")
        .insert({
          shift_id: selectedShift.id,
          caregiver_id: caregiverId,
          status: "scheduled",
          assignment_method: "ai_suggested"
        });

      if (assignError) throw assignError;

      // Update shift status and caregiver_id
      const { error: updateError } = await supabase
        .from("shifts")
        .update({ 
          status: "assigned",
          caregiver_id: caregiverId
        })
        .eq("id", selectedShift.id);

      if (updateError) throw updateError;

      toast.success("Shift assigned successfully!");
      
      // Refresh data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fetchData(user.id);
        setSelectedShift(null);
        setMatchedCaregivers([]);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to assign shift");
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50";
    if (score >= 75) return "text-blue-600 bg-blue-50";
    if (score >= 60) return "text-yellow-600 bg-yellow-50";
    return "text-orange-600 bg-orange-50";
  };

  return (
    <AppLayout>
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Quick Assign</h1>
        <p className="text-muted-foreground mb-6">AI-powered shift assignment</p>

        {loading ? (
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
          {/* Step 1: Select Shift */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                Step 1: Select Shift to Assign
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select 
                value={selectedShift?.id || ""} 
                onValueChange={handleShiftSelect}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an open shift..." />
                </SelectTrigger>
                <SelectContent>
                  {openShifts.length === 0 ? (
                    <SelectItem value="none" disabled>No open shifts available</SelectItem>
                  ) : (
                    openShifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.clients?.first_name} {shift.clients?.last_name} - {" "}
                        {format(new Date(shift.shift_date), "MMM d")} {" "}
                        ({shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}) - {" "}
                        {shift.care_type_code.replace(/_/g, " ")}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {selectedShift && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                  <h4 className="font-semibold mb-2">Selected Shift Details</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Client:</span> {selectedShift.clients?.first_name} {selectedShift.clients?.last_name}</p>
                    <p><span className="font-medium">Location:</span> {selectedShift.clients?.city}, {selectedShift.clients?.state}</p>
                    <p><span className="font-medium">Date:</span> {format(new Date(selectedShift.shift_date), "MMM d, yyyy")}</p>
                    <p><span className="font-medium">Time:</span> {selectedShift.start_time.slice(0, 5)} - {selectedShift.end_time.slice(0, 5)}</p>
                    <p><span className="font-medium">Care Type:</span> {selectedShift.care_type_code.replace(/_/g, " ")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: View Matched Caregivers */}
          {selectedShift && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  Step 2: Select Caregiver (AI Matched & Ranked)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {matching ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Finding best caregiver matches...</p>
                  </div>
                ) : matchedCaregivers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No matching caregivers found</p>
                ) : (
                  <div className="space-y-3">
                    {matchedCaregivers.map((match, index) => (
                      <Card key={match.caregiver_id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <Badge className="text-lg px-3 py-1">
                                  #{index + 1}
                                </Badge>
                                <div>
                                  <p className="font-semibold text-lg">
                                    {match.caregiver?.first_name} {match.caregiver?.last_name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-4 h-4 ${
                                          i < Math.floor(match.caregiver?.performance_rating || 0)
                                            ? "fill-yellow-400 text-yellow-400"
                                            : "text-gray-300"
                                        }`}
                                      />
                                    ))}
                                    <span className="text-sm text-muted-foreground">
                                      {match.caregiver?.performance_rating?.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold ${getMatchScoreColor(match.match_score)}`}>
                                <TrendingUp className="w-4 h-4" />
                                <span>{match.match_score}% Match</span>
                              </div>

                              <div className="bg-muted/50 p-3 rounded-lg">
                                <p className="text-sm font-medium mb-1">AI Reasoning:</p>
                                <p className="text-sm text-muted-foreground">{match.key_factors.reasoning}</p>
                                {match.key_factors.warnings && match.key_factors.warnings.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <p className="text-sm font-medium text-warning mb-1">Warnings:</p>
                                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                                      {match.key_factors.warnings.map((warning, i) => (
                                        <li key={i}>{warning}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>

                            <Button 
                              onClick={() => handleAssignCaregiver(match.caregiver_id)}
                              className="shrink-0"
                            >
                              Assign
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default QuickAssign;
