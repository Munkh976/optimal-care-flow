import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, ChevronLeft, ChevronRight, Package, CheckCircle2, Edit, Users, Star, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

interface CareType {
  id: string;
  care_need_code: string;
  care_types: {
    name: string;
    code: string;
    category: string;
  };
}

interface Order {
  id: string;
  order_number: string;
  start_date: string;
  end_date: string;
  status: string;
  frequency: string;
  created_at: string;
}

interface Caregiver {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate: number;
  performance_rating: number;
  availability: any;
  caregiver_availability?: TimeSlot[];
}

interface TimeSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface OrdersManagementProps {
  clientProfile: { id: string; agency_id: string } | null;
  user: any;
  availableCareTypes: CareType[];
  currentOrder: Order | null;
  onRefresh: () => void;
}

interface Shift {
  dayOfWeek: number;
  caregiverId: string;
  caregiverName: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
}

export const OrdersManagement = ({ 
  clientProfile, 
  user, 
  availableCareTypes, 
  currentOrder,
  onRefresh 
}: OrdersManagementProps) => {
  const [step, setStep] = useState(1);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  // Step 1: Care Need Selection
  const [selectedCareNeed, setSelectedCareNeed] = useState("");
  const [selectedCareTypeCodes, setSelectedCareTypeCodes] = useState<string[]>([]);
  const [careNeedDurationHours, setCareNeedDurationHours] = useState<number | null>(null);
  
  // Step 2: Day Selection
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  // Step 3: Caregiver Selection for selected day
  const [availableCaregivers, setAvailableCaregivers] = useState<any[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState("");
  const [sortBy, setSortBy] = useState<"rating" | "price">("rating");
  
  // Step 4: Timeslot Selection
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  
  // Step 5: Collected Shifts
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  // Step 6: Start Date & Duration
  const [startDate, setStartDate] = useState("");
  const [durationMonths, setDurationMonths] = useState(1);
  const [durationWeeks, setDurationWeeks] = useState(1);
  
  const [notes, setNotes] = useState("");

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (step === 3 && selectedDay !== null) {
      fetchAvailableCaregiversForDay();
    }
  }, [step, selectedDay, sortBy]);

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  };

  const fetchAvailableCaregiversForDay = async () => {
    if (!clientProfile || selectedDay === null) return;

    try {
      const { data: clientData, error: clientErr } = await supabase
        .from("clients")
        .select("zip_code")
        .eq("id", clientProfile.id)
        .single();
      
      if (clientErr) {
        toast.error("Could not load client location");
        return;
      }

      const clientZipCode = clientData?.zip_code;
      if (!clientZipCode) {
        toast.error("Client zip code not found");
        return;
      }

      const { data: caregivers, error } = await supabase
        .from("caregivers")
        .select(`
          id,
          first_name,
          last_name,
          hourly_rate,
          performance_rating,
          service_zipcodes,
          caregiver_availability(
            day_of_week,
            start_time,
            end_time,
            is_available
          )
        `)
        .eq("is_active", true);

      if (error) throw error;

      // Filter: must service client's zipcode AND be available on selected day
      const filteredCaregivers = (caregivers || [])
        .filter((cg) => {
          const serviceZipcodes = cg.service_zipcodes || [];
          if (!serviceZipcodes.includes(clientZipCode)) return false;
          
          const daySlot = cg.caregiver_availability?.find(
            (slot: any) => slot.day_of_week === selectedDay && slot.is_available
          );
          return !!daySlot;
        })
        .map((cg) => {
          const daySlot = cg.caregiver_availability?.find(
            (slot: any) => slot.day_of_week === selectedDay
          );
          return {
            ...cg,
            availableSlot: daySlot ? {
              start_time: typeof daySlot.start_time === "string" ? daySlot.start_time.slice(0, 5) : daySlot.start_time,
              end_time: typeof daySlot.end_time === "string" ? daySlot.end_time.slice(0, 5) : daySlot.end_time,
            } : null
          };
        });

      const sortedCaregivers = [...filteredCaregivers].sort((a, b) => {
        if (sortBy === "rating") {
          return (b.performance_rating || 0) - (a.performance_rating || 0);
        } else {
          return (a.hourly_rate || 0) - (b.hourly_rate || 0);
        }
      });

      setAvailableCaregivers(sortedCaregivers);

      if (sortedCaregivers.length === 0) {
        toast.info(`No caregivers available on ${dayNames[selectedDay]}`);
      }
    } catch (error: any) {
      toast.error("Failed to fetch caregivers");
      console.error(error);
    }
  };

  const handleSubmitOrder = async () => {
    if (!clientProfile || shifts.length === 0 || !startDate) {
      toast.error("Please complete all required fields");
      return;
    }

    try {
      const start = new Date(startDate);
      const end = new Date(start);
      const totalWeeks = durationMonths * 4 + durationWeeks;
      end.setDate(start.getDate() + (totalWeeks * 7) - 1);

      const orderNumber = `ORD-${Date.now()}`;
      const { data: newOrder, error: orderError } = await supabase
        .from("client_orders")
        .insert({
          client_id: clientProfile.id,
          agency_id: clientProfile.agency_id,
          order_number: orderNumber,
          start_date: startDate,
          end_date: end.toISOString().split('T')[0],
          frequency: "weekly",
          status: "submitted"
        })
        .select()
        .single();

      if (orderError) throw orderError;

      await createShiftsFromCollection(newOrder.id);
      toast.success("Order submitted successfully!");
      resetForm();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit order");
    }
  };

  const createShiftsFromCollection = async (orderId: string) => {
    const shiftsToCreate = [];
    const start = new Date(startDate);
    const end = new Date(start);
    const totalWeeks = durationMonths * 4 + durationWeeks;
    end.setDate(start.getDate() + (totalWeeks * 7) - 1);

    const primaryCareTypeCode = selectedCareTypeCodes[0] || selectedCareNeed;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const shift = shifts.find(s => s.dayOfWeek === dayOfWeek);
      
      if (shift) {
        const shiftDate = d.toISOString().split('T')[0];
        const [startHour, startMin] = shift.startTime.split(':').map(Number);
        const [endHour, endMin] = shift.endTime.split(':').map(Number);
        const durationHours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;

        shiftsToCreate.push({
          client_id: clientProfile!.id,
          agency_id: clientProfile!.agency_id,
          caregiver_id: shift.caregiverId,
          order_id: orderId,
          shift_date: shiftDate,
          start_time: shift.startTime,
          end_time: shift.endTime,
          duration_hours: durationHours,
          care_type_code: primaryCareTypeCode,
          status: 'scheduled',
          special_notes: notes,
          order_title: `Care Service`
        });
      }
    }

    const { error } = await supabase
      .from("shifts")
      .insert(shiftsToCreate);

    if (error) throw error;
  };

  const resetForm = () => {
    setShowOrderForm(false);
    setEditingOrderId(null);
    setStep(1);
    setSelectedCareNeed("");
    setSelectedCareTypeCodes([]);
    setCareNeedDurationHours(null);
    setSelectedDay(null);
    setAvailableCaregivers([]);
    setSelectedCaregiver("");
    setSortBy("rating");
    setSelectedStartTime("");
    setSelectedEndTime("");
    setShifts([]);
    setStartDate("");
    setDurationMonths(1);
    setDurationWeeks(1);
    setNotes("");
  };
  
  const addShiftToCollection = () => {
    if (!selectedCaregiver || !selectedStartTime || !selectedEndTime || selectedDay === null) {
      toast.error("Please complete all shift details");
      return;
    }
    
    const caregiver = availableCaregivers.find(c => c.id === selectedCaregiver);
    if (!caregiver) return;
    
    // Check if shift already exists for this day
    if (shifts.some(s => s.dayOfWeek === selectedDay)) {
      toast.error(`You already have a shift scheduled for ${dayNames[selectedDay]}`);
      return;
    }
    
    const newShift: Shift = {
      dayOfWeek: selectedDay,
      caregiverId: selectedCaregiver,
      caregiverName: `${caregiver.first_name} ${caregiver.last_name}`,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      hourlyRate: caregiver.hourly_rate
    };
    
    setShifts([...shifts, newShift]);
    
    // Reset for next shift
    setSelectedDay(null);
    setSelectedCaregiver("");
    setSelectedStartTime("");
    setSelectedEndTime("");
    setAvailableCaregivers([]);
    setStep(2); // Back to day selection
    
    toast.success("Shift added! Add more or continue to review.");
  };
  
  const removeShift = (dayOfWeek: number) => {
    setShifts(shifts.filter(s => s.dayOfWeek !== dayOfWeek));
  };

  const handleEditDraft = async (order: Order) => {
    setEditingOrderId(order.id);
    setStartDate(order.start_date);
    setShowOrderForm(true);
    setStep(1);
  };

  const updateStartTime = (value: string) => {
    setSelectedStartTime(value);
    // Auto-calculate end time if care need has fixed duration
    if (careNeedDurationHours && !Number.isNaN(careNeedDurationHours)) {
      const [sh, sm] = value.split(':').map(Number);
      const minutes = sh * 60 + sm + Math.round(careNeedDurationHours * 60);
      const eh = Math.floor(minutes / 60) % 24;
      const em = minutes % 60;
      setSelectedEndTime(`${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "outline", label: "Draft" },
      submitted: { variant: "secondary", label: "Submitted" },
      active: { variant: "default", label: "Active" },
      completed: { variant: "secondary", label: "Completed" }
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Orders Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage your care orders</p>
        </div>
        {!showOrderForm && (
          <Button onClick={() => setShowOrderForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        )}
      </div>

      {/* Order Form */}
      {showOrderForm && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{editingOrderId ? 'Edit' : 'Create'} Care Order</CardTitle>
                <CardDescription>Step {step} of 2</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  1
                </div>
                <div className={`h-1 w-12 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  2
                </div>
                <div className={`h-1 w-12 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  3
                </div>
                <div className={`h-1 w-12 ${step >= 4 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold ${step >= 4 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  4
                </div>
                <div className={`h-1 w-12 ${step >= 5 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold ${step >= 5 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  5
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {step === 1 && "Select Care Need"}
                {step === 2 && "Choose Day"}
                {step === 3 && "Select Caregiver"}
                {step === 4 && "Choose Timeslot"}
                {step === 5 && "Review & Schedule"}
              </div>
            </div>

            {/* Step 1: Select Care Need */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Select Your Care Need</Label>
                  <Select 
                    value={selectedCareNeed} 
                    onValueChange={async (value) => {
                      setSelectedCareNeed(value);
                      try {
                        const selected = availableCareTypes.find(n => n.care_need_code === value);
                        const typeName = selected?.care_types?.name || "";
                        
                        // Use the selected care type code directly
                        setSelectedCareTypeCodes([value]);
                        
                        // Set a default duration if needed (can be adjusted)
                        setCareNeedDurationHours(4); // Default 4 hours, can be customized per care type
                      } catch (e) {
                        console.warn("Care type mapping fallback used", e);
                        setSelectedCareTypeCodes([]);
                        setCareNeedDurationHours(null);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose from your care needs" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCareTypes.map((type) => (
                        <SelectItem key={type.id} value={type.care_need_code}>
                          <div>
                            <div className="font-medium">{type.care_types.name}</div>
                            <div className="text-xs text-muted-foreground">{type.care_types.category}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {careNeedDurationHours && (
                    <p className="text-sm text-muted-foreground">
                      Standard duration: {careNeedDurationHours} hours per shift
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={resetForm} className="flex-1">
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      if (selectedCareNeed) {
                        setStep(2);
                      } else {
                        toast.error("Please select a care need");
                      }
                    }} 
                    className="flex-1"
                    disabled={!selectedCareNeed}
                  >
                    Next: Choose Day
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Choose Day */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-lg font-semibold">Select a Day for Care</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose which day of the week you need care. You can add more days later.
                  </p>
                </div>
                
                {shifts.length > 0 && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4">
                      <Label className="text-sm font-semibold mb-2 block">Shifts Added ({shifts.length})</Label>
                      <div className="space-y-2">
                        {shifts.map((shift) => (
                          <div key={shift.dayOfWeek} className="flex items-center justify-between text-sm bg-background p-2 rounded">
                            <span className="font-medium">{dayNames[shift.dayOfWeek]}</span>
                            <span className="text-muted-foreground">{shift.caregiverName}</span>
                            <span className="text-xs">{shift.startTime} - {shift.endTime}</span>
                            <Button variant="ghost" size="sm" onClick={() => removeShift(shift.dayOfWeek)}>
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {dayNames.map((day, idx) => {
                    const alreadyScheduled = shifts.some(s => s.dayOfWeek === idx);
                    return (
                      <Card 
                        key={idx}
                        className={`cursor-pointer transition-all ${
                          selectedDay === idx 
                            ? 'ring-2 ring-primary border-primary bg-primary/10' 
                            : alreadyScheduled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => {
                          if (!alreadyScheduled) {
                            setSelectedDay(idx);
                          }
                        }}
                      >
                        <CardContent className="p-4 text-center">
                          <div className="font-semibold">{day}</div>
                          {alreadyScheduled && (
                            <Badge variant="secondary" className="mt-2 text-xs">Scheduled</Badge>
                          )}
                          {selectedDay === idx && (
                            <CheckCircle2 className="h-4 w-4 text-primary mx-auto mt-2" />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button 
                    onClick={() => {
                      if (selectedDay !== null) {
                        setStep(3);
                      } else {
                        toast.error("Please select a day");
                      }
                    }} 
                    className="flex-1"
                    disabled={selectedDay === null}
                  >
                    Next: View Caregivers
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Select Caregiver */}
            {step === 3 && selectedDay !== null && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-lg font-semibold">Available Caregivers for {dayNames[selectedDay]}</Label>
                  <p className="text-sm text-muted-foreground">
                    Select a caregiver who is available on {dayNames[selectedDay]}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {availableCaregivers.length} caregiver{availableCaregivers.length !== 1 ? 's' : ''} available
                  </p>
                  <Select value={sortBy} onValueChange={(value: "rating" | "price") => setSortBy(value)}>
                    <SelectTrigger className="w-[180px]">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rating">Sort by Rating</SelectItem>
                      <SelectItem value="price">Sort by Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {availableCaregivers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No caregivers available on {dayNames[selectedDay]}</p>
                    <Button variant="outline" className="mt-4" onClick={() => {
                      setSelectedDay(null);
                      setStep(2);
                    }}>
                      Choose Different Day
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {availableCaregivers.map((caregiver) => (
                      <Card 
                        key={caregiver.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${selectedCaregiver === caregiver.id ? 'border-primary border-2 bg-primary/5' : ''}`}
                        onClick={() => setSelectedCaregiver(caregiver.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12">
                                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                                  {caregiver.first_name[0]}{caregiver.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-base">
                                  {caregiver.first_name} {caregiver.last_name}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i} 
                                        className={`h-3 w-3 ${i < Math.floor(caregiver.performance_rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                                      />
                                    ))}
                                    <span className="text-sm text-muted-foreground ml-1">
                                      {caregiver.performance_rating?.toFixed(1) || '0.0'}
                                    </span>
                                  </div>
                                  <Badge variant="secondary" className="font-semibold">
                                    ${caregiver.hourly_rate}/hr
                                  </Badge>
                                </div>
                                {caregiver.availableSlot && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Available: {caregiver.availableSlot.start_time} - {caregiver.availableSlot.end_time}
                                  </div>
                                )}
                              </div>
                            </div>
                            {selectedCaregiver === caregiver.id && (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => {
                    setSelectedCaregiver("");
                    setSelectedDay(null);
                    setAvailableCaregivers([]);
                    setStep(2);
                  }}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button 
                    onClick={() => setStep(4)} 
                    className="flex-1"
                    disabled={!selectedCaregiver}
                  >
                    Next: Choose Time
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Choose Timeslot */}
            {step === 4 && selectedCaregiver && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-lg font-semibold">Select Shift Times</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose start and end times for your shift on {dayNames[selectedDay!]}
                  </p>
                </div>

                {(() => {
                  const caregiver = availableCaregivers.find(c => c.id === selectedCaregiver);
                  const slot = caregiver?.availableSlot;
                  
                  return slot && (
                    <>
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <Label className="text-sm font-medium">Caregiver Availability</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {slot.start_time} - {slot.end_time}
                          </p>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-time">Start Time</Label>
                          <Input
                            id="start-time"
                            type="time"
                            value={selectedStartTime}
                            onChange={(e) => updateStartTime(e.target.value)}
                            min={slot.start_time}
                            max={slot.end_time}
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-time" className="flex items-center gap-2">
                            End Time
                            {careNeedDurationHours && (
                              <Badge variant="secondary" className="text-xs">
                                Auto: {careNeedDurationHours}h
                              </Badge>
                            )}
                          </Label>
                          <Input
                            id="end-time"
                            type="time"
                            value={selectedEndTime}
                            onChange={(e) => setSelectedEndTime(e.target.value)}
                            min={selectedStartTime || slot.start_time}
                            max={slot.end_time}
                            readOnly={!!careNeedDurationHours}
                            className={`font-mono ${careNeedDurationHours ? 'bg-muted' : ''}`}
                          />
                        </div>
                      </div>

                      {selectedStartTime && selectedEndTime && (
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              <p className="text-sm font-medium">
                                Shift: {dayNames[selectedDay!]}, {selectedStartTime} - {selectedEndTime}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  );
                })()}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => {
                    setSelectedStartTime("");
                    setSelectedEndTime("");
                    setStep(3);
                  }}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      addShiftToCollection();
                    }} 
                    className="flex-1"
                    disabled={!selectedStartTime || !selectedEndTime}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add More Shifts
                  </Button>
                  <Button 
                    onClick={() => {
                      addShiftToCollection();
                      setStep(5);
                    }} 
                    className="flex-1"
                    disabled={!selectedStartTime || !selectedEndTime}
                  >
                    Next: Review
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Review & Schedule */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-lg font-semibold">Review & Schedule</Label>
                  <p className="text-sm text-muted-foreground">
                    Review your shifts and set the start date and duration
                  </p>
                </div>

                {/* Shifts Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Scheduled Shifts ({shifts.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {shifts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No shifts added yet</p>
                    ) : (
                      shifts.map((shift) => (
                        <div key={shift.dayOfWeek} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                          <div className="space-y-1">
                            <div className="font-semibold">{dayNames[shift.dayOfWeek]}</div>
                            <div className="text-sm text-muted-foreground">{shift.caregiverName}</div>
                            <div className="text-xs text-muted-foreground">
                              {shift.startTime} - {shift.endTime} • ${shift.hourlyRate}/hr
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeShift(shift.dayOfWeek)}>
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Start Date & Duration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={getNextMonday()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration-months">Duration (Months)</Label>
                    <Input
                      id="duration-months"
                      type="number"
                      min="0"
                      max="12"
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration-weeks">+ Weeks</Label>
                    <Input
                      id="duration-weeks"
                      type="number"
                      min="1"
                      max="4"
                      value={durationWeeks}
                      onChange={(e) => setDurationWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total duration: {durationMonths > 0 ? `${durationMonths} month${durationMonths > 1 ? 's' : ''}` : ''} 
                  {durationMonths > 0 && durationWeeks > 0 ? ' and ' : ''}
                  {durationWeeks > 0 ? `${durationWeeks} week${durationWeeks > 1 ? 's' : ''}` : ''}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions or requirements..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => {
                    if (shifts.length === 0) {
                      setStep(2);
                    } else {
                      toast.info("Add more shifts or submit order");
                    }
                  }}>
                    {shifts.length === 0 ? (
                      <>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add More Shifts
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleSubmitOrder} 
                    className="flex-1"
                    disabled={shifts.length === 0 || !startDate}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Submit Order
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Orders</h3>
        {currentOrder ? (
          <Card className="hover-scale">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{currentOrder.order_number}</CardTitle>
                  <CardDescription>
                    {new Date(currentOrder.start_date).toLocaleDateString()} - {new Date(currentOrder.end_date).toLocaleDateString()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(currentOrder.status)}
                  {currentOrder.status === 'draft' && (
                    <Button variant="ghost" size="sm" onClick={() => handleEditDraft(currentOrder)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};