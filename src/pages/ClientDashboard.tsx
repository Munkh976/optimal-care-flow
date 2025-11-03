import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar, LogOut, Plus, Trash2, Clock, CheckCircle2, Package,
  ChevronLeft, ChevronRight
} from "lucide-react";

interface ClientProfile {
  id: string;
  first_name: string;
  last_name: string;
  agency_id: string;
}

interface CareNeed {
  id: string;
  care_need_code: string;
  priority: number;
  notes: string | null;
  care_needs: {
    name: string;
    code: string;
    category: string;
    description: string | null;
  };
}

interface Order {
  id: string;
  order_number: string;
  start_date: string;
  end_date: string;
  status: string;
  frequency: string;
  days_of_week: string | null;
  created_at: string;
}

interface CareNeedInput {
  care_need_code: string;
  selected_days: number[];
  start_time: string;
  duration: number;
  notes: string;
}

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [availableCareNeeds, setAvailableCareNeeds] = useState<CareNeed[]>([]);
  
  // Step 1 state
  const [step, setStep] = useState(1);
  const [durationWeeks, setDurationWeeks] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>("");
  
  // Step 2 state
  const [careNeedInputs, setCareNeedInputs] = useState<CareNeedInput[]>([]);
  const [showCareNeedForm, setShowCareNeedForm] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    await fetchClientData(session.user.id);
    setLoading(false);
  };

  const fetchClientData = async (userId: string) => {
    // Fetch client profile - user could be linked via email or we create one
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id, first_name, last_name, agency_id")
      .eq("agency_id", userId)
      .maybeSingle();

    console.log("Client data fetch:", { clientData, clientError, userId, userEmail: user?.email });

    if (clientData) {
      setClientProfile(clientData);
      
      // Fetch current week's order (draft or submitted)
      const today = new Date();
      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      const { data: orderData, error: orderError } = await supabase
        .from("client_orders")
        .select("*")
        .eq("client_id", clientData.id)
        .gte("start_date", weekStartStr)
        .in("status", ["draft", "submitted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("Order data fetch:", { orderData, orderError });
      setCurrentOrder(orderData || null);
      
      // Fetch client's care needs
      const { data: careNeedsData, error: careNeedsError } = await supabase
        .from("client_care_needs")
        .select("*, care_needs(*)")
        .eq("client_id", clientData.id)
        .order("priority", { ascending: false });

      console.log("Care needs fetch:", { careNeedsData, careNeedsError });
      setAvailableCareNeeds(careNeedsData || []);
    } else {
      console.error("No client profile found for user:", userId);
      toast.error("Client profile not found. Please contact your agency.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  };

  const handleSaveOrder = async (status: 'draft' | 'submitted') => {
    console.log("handleSaveOrder called:", { status, step, clientProfile, startDate, durationWeeks });
    
    if (!clientProfile) {
      toast.error("Client profile not found");
      return;
    }
    
    if (step === 1) {
      // Validate step 1
      if (!startDate || durationWeeks < 1 || durationWeeks > 52) {
        toast.error("Please select a valid start date and duration");
        return;
      }
      
      // Calculate end date
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(start.getDate() + (durationWeeks * 7) - 1);
      
      console.log("Calculated dates:", { startDate, endDate: end.toISOString().split('T')[0] });
      
      try {
        if (currentOrder) {
          // Update existing order
          console.log("Updating existing order:", currentOrder.id);
          const { data, error } = await supabase
            .from("client_orders")
            .update({
              start_date: startDate,
              end_date: end.toISOString().split('T')[0],
              frequency: "weekly",
              status: status,
              updated_at: new Date().toISOString()
            })
            .eq("id", currentOrder.id)
            .select()
            .single();

          if (error) {
            console.error("Update error:", error);
            throw error;
          }
          
          console.log("Order updated successfully:", data);
          setCurrentOrder(data);
          toast.success(status === 'draft' ? "Order saved as draft" : "Moving to care needs...");
          
          if (status === 'submitted') {
            console.log("Setting step to 2");
            setStep(2);
          }
        } else {
          // Create new order
          const orderNumber = `ORD-${Date.now()}`;
          console.log("Creating new order:", orderNumber);
          
          const insertData = {
            client_id: clientProfile.id,
            agency_id: clientProfile.agency_id,
            order_number: orderNumber,
            start_date: startDate,
            end_date: end.toISOString().split('T')[0],
            frequency: "weekly",
            status: status
          };
          
          console.log("Insert data:", insertData);
          
          const { data: newOrder, error } = await supabase
            .from("client_orders")
            .insert(insertData)
            .select()
            .single();

          if (error) {
            console.error("Insert error:", error);
            throw error;
          }
          
          console.log("Order created successfully:", newOrder);
          setCurrentOrder(newOrder);
          toast.success(status === 'draft' ? "Order saved as draft" : "Moving to care needs...");
          
          if (status === 'submitted') {
            console.log("Setting step to 2");
            setStep(2);
          }
        }
      } catch (error: any) {
        console.error("Error saving order:", error);
        toast.error(error.message || "Failed to save order");
      }
    } else {
      // Step 2: Save care needs as shifts
      if (careNeedInputs.length === 0) {
        toast.error("Please add at least one care need");
        return;
      }
      
      try {
        const shiftsToCreate = [];
        
        for (const careNeed of careNeedInputs) {
          const start = new Date(currentOrder!.start_date);
          const end = new Date(currentOrder!.end_date);
          
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (careNeed.selected_days.includes(dayOfWeek)) {
              const shiftDate = d.toISOString().split('T')[0];
              const startTime = careNeed.start_time;
              const [hours, minutes] = startTime.split(':');
              const endDate = new Date(d);
              endDate.setHours(parseInt(hours) + careNeed.duration, parseInt(minutes));
              const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
              
              shiftsToCreate.push({
                client_id: clientProfile!.id,
                agency_id: user.id,
                shift_date: shiftDate,
                start_time: startTime,
                end_time: endTime,
                duration_hours: careNeed.duration,
                care_type: 'companion_care',
                status: 'open',
                special_notes: careNeed.notes,
                order_title: `Care Need - ${careNeed.care_need_code}`
              });
            }
          }
        }
        
        const { data: shifts, error: shiftsError } = await supabase
          .from("shifts")
          .insert(shiftsToCreate)
          .select();

        if (shiftsError) throw shiftsError;

        // Link shifts to order
        const orderShifts = shifts.map(shift => ({
          order_id: currentOrder!.id,
          shift_id: shift.id
        }));

        const { error: linkError } = await supabase
          .from("order_shifts")
          .insert(orderShifts);

        if (linkError) throw linkError;

        // Update order status
        const { error: updateError } = await supabase
          .from("client_orders")
          .update({ status: status })
          .eq("id", currentOrder!.id);

        if (updateError) throw updateError;

        toast.success(status === 'draft' ? "Order saved as draft" : "Order submitted successfully!");
        
        // Reset form
        setCareNeedInputs([]);
        setShowCareNeedForm(false);
        setStep(1);
        await fetchClientData(user.id);
      } catch (error: any) {
        console.error("Error saving care needs:", error);
        toast.error(error.message || "Failed to save care needs");
      }
    }
  };

  const handleAddCareNeed = () => {
    setCareNeedInputs([...careNeedInputs, {
      care_need_code: "",
      selected_days: [],
      start_time: "09:00",
      duration: 2,
      notes: ""
    }]);
    setShowCareNeedForm(true);
  };

  const handleRemoveCareNeed = (index: number) => {
    setCareNeedInputs(careNeedInputs.filter((_, i) => i !== index));
    if (careNeedInputs.length === 1) {
      setShowCareNeedForm(false);
    }
  };

  const updateCareNeedInput = (index: number, field: keyof CareNeedInput, value: any) => {
    const updated = [...careNeedInputs];
    updated[index] = { ...updated[index], [field]: value };
    setCareNeedInputs(updated);
  };

  const toggleDay = (inputIndex: number, day: number) => {
    const updated = [...careNeedInputs];
    const currentDays = updated[inputIndex].selected_days;
    if (currentDays.includes(day)) {
      updated[inputIndex].selected_days = currentDays.filter(d => d !== day);
    } else {
      updated[inputIndex].selected_days = [...currentDays, day].sort();
    }
    setCareNeedInputs(updated);
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/95 backdrop-blur sticky top-0 z-30 shadow-sm">
        <div className="px-4 md:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Welcome, {clientProfile?.first_name}</h1>
            <p className="text-sm text-muted-foreground">Manage your weekly care orders</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 max-w-4xl">
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Calendar className="h-5 w-5" />
            </div>
            <div className={`h-1 w-16 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground px-4">
            <span className={step === 1 ? 'font-semibold text-foreground' : ''}>Order Details</span>
            <span className={step === 2 ? 'font-semibold text-foreground' : ''}>Care Needs</span>
          </div>
        </div>

        {/* Step 1: Order Details */}
        {step === 1 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Create Your Weekly Order
              </CardTitle>
              <CardDescription>
                Choose when your care services should start and for how long
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date (Monday)</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getNextMonday()}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Orders start on Mondays. Select the first Monday of your care period.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (Weeks)</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setDurationWeeks(Math.max(1, durationWeeks - 1))}
                    disabled={durationWeeks <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="52"
                    value={durationWeeks}
                    onChange={(e) => setDurationWeeks(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                    className="text-center text-lg font-semibold w-20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setDurationWeeks(Math.min(52, durationWeeks + 1))}
                    disabled={durationWeeks >= 52}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">weeks</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose between 1 to 52 weeks of recurring care
                </p>
              </div>

              {startDate && (
                <div className="p-4 bg-primary/5 rounded-lg border">
                  <p className="text-sm font-medium mb-1">Order Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Your care will run for {durationWeeks} week{durationWeeks > 1 ? 's' : ''} starting {new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleSaveOrder('draft')}
                  disabled={!startDate || durationWeeks < 1}
                >
                  Save as Draft
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleSaveOrder('submitted')}
                  disabled={!startDate || durationWeeks < 1}
                >
                  Continue to Care Needs
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Care Needs */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Add Your Care Needs
                </CardTitle>
                <CardDescription>
                  Select from your registered care needs and schedule them throughout the week
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showCareNeedForm && careNeedInputs.length === 0 && (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">No care needs added yet</p>
                    <Button onClick={handleAddCareNeed}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Care Need
                    </Button>
                  </div>
                )}

                {careNeedInputs.map((careNeedInput, index) => (
                  <Card key={index} className="border-2">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-sm">Care Need #{index + 1}</h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCareNeed(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Select Care Need</Label>
                        <Select
                          value={careNeedInput.care_need_code}
                          onValueChange={(value) => updateCareNeedInput(index, 'care_need_code', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a care need" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCareNeeds.map((need) => (
                              <SelectItem key={need.id} value={need.care_need_code}>
                                <div>
                                  <div className="font-medium">{need.care_needs.name}</div>
                                  <div className="text-xs text-muted-foreground">{need.care_needs.category}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Days of Week</Label>
                        <div className="flex flex-wrap gap-2">
                          {dayNames.map((day, dayIndex) => (
                            <Button
                              key={dayIndex}
                              type="button"
                              variant={careNeedInput.selected_days.includes(dayIndex) ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleDay(index, dayIndex)}
                              className="flex-1 min-w-[60px]"
                            >
                              {day}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={careNeedInput.start_time}
                            onChange={(e) => updateCareNeedInput(index, 'start_time', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration</Label>
                          <Select
                            value={String(careNeedInput.duration)}
                            onValueChange={(value) => updateCareNeedInput(index, 'duration', parseInt(value))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">2 hours</SelectItem>
                              <SelectItem value="3">3 hours</SelectItem>
                              <SelectItem value="4">4 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea
                          value={careNeedInput.notes}
                          onChange={(e) => updateCareNeedInput(index, 'notes', e.target.value)}
                          placeholder="Any special instructions..."
                          rows={2}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {careNeedInputs.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleAddCareNeed}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Another Care Need
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleSaveOrder('draft')}
                disabled={careNeedInputs.length === 0}
              >
                Save as Draft
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleSaveOrder('submitted')}
                disabled={careNeedInputs.length === 0}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Submit Order
              </Button>
            </div>
          </div>
        )}

        {/* Current Order Status */}
        {currentOrder && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Current Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm">{currentOrder.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(currentOrder.start_date).toLocaleDateString()} - {new Date(currentOrder.end_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={currentOrder.status === 'draft' ? 'outline' : 'default'}>
                  {currentOrder.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ClientDashboard;
