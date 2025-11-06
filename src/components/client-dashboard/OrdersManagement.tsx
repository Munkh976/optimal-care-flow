import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, ChevronLeft, ChevronRight, Package, CheckCircle2, Edit, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

interface CareNeed {
  id: string;
  care_need_code: string;
  care_needs: {
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
}

interface TimeSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface OrdersManagementProps {
  clientProfile: { id: string; agency_id: string } | null;
  user: any;
  availableCareNeeds: CareNeed[];
  currentOrder: Order | null;
  onRefresh: () => void;
}

export const OrdersManagement = ({ 
  clientProfile, 
  user, 
  availableCareNeeds, 
  currentOrder,
  onRefresh 
}: OrdersManagementProps) => {
  const [step, setStep] = useState(1);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  // Step 1: Care Need Selection
  const [selectedCareNeed, setSelectedCareNeed] = useState("");
  
  // Step 2: Date & Days Selection
  const [startDate, setStartDate] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  
  // Step 3: Caregiver & Time Selection
  const [availableCaregivers, setAvailableCaregivers] = useState<any[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState("");
  const [caregiverAvailability, setCaregiverAvailability] = useState<TimeSlot[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<{[key: number]: {start: string, end: string}}>({});
  const [notes, setNotes] = useState("");

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (step === 3 && selectedDays.length > 0) {
      fetchAvailableCaregivers();
    }
  }, [step, selectedDays]);

  useEffect(() => {
    if (selectedCaregiver) {
      fetchCaregiverAvailability();
    }
  }, [selectedCaregiver]);

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  };

  const fetchAvailableCaregivers = async () => {
    if (!clientProfile) return;

    try {
      // Get caregivers with their skills matching the selected care need
      const { data: caregivers, error } = await supabase
        .from("caregivers")
        .select(`
          id,
          first_name,
          last_name,
          hourly_rate,
          performance_rating,
          caregiver_skills!inner(care_type_code)
        `)
        .eq("agency_id", clientProfile.agency_id)
        .eq("is_active", true)
        .eq("caregiver_skills.care_type_code", selectedCareNeed);

      if (error) throw error;

      setAvailableCaregivers(caregivers || []);
    } catch (error: any) {
      toast.error("Failed to fetch caregivers");
      console.error(error);
    }
  };

  const fetchCaregiverAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from("caregiver_availability")
        .select("*")
        .eq("caregiver_id", selectedCaregiver)
        .in("day_of_week", selectedDays)
        .eq("is_available", true)
        .order("day_of_week");

      if (error) throw error;
      setCaregiverAvailability(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch availability");
      console.error(error);
    }
  };

  const handleSaveOrder = async (status: 'draft' | 'submitted') => {
    if (!clientProfile) {
      toast.error("Client profile not found");
      return;
    }

    // Validation based on step
    if (step === 1 && !selectedCareNeed) {
      toast.error("Please select a care need");
      return;
    }

    if (step === 2) {
      if (!startDate || selectedDays.length === 0) {
        toast.error("Please select start date and days");
        return;
      }
    }

    if (step === 3 && status === 'submitted') {
      if (!selectedCaregiver || Object.keys(selectedTimeSlots).length === 0) {
        toast.error("Please select caregiver and time slots");
        return;
      }
    }

    try {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(start.getDate() + (durationWeeks * 7) - 1);

      let orderId = editingOrderId;

      // Create or update order
      if (editingOrderId) {
        const { error } = await supabase
          .from("client_orders")
          .update({
            start_date: startDate,
            end_date: end.toISOString().split('T')[0],
            status: status,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingOrderId);

        if (error) throw error;
      } else {
        const orderNumber = `ORD-${Date.now()}`;
        const { data: newOrder, error } = await supabase
          .from("client_orders")
          .insert({
            client_id: clientProfile.id,
            agency_id: clientProfile.agency_id,
            order_number: orderNumber,
            start_date: startDate,
            end_date: end.toISOString().split('T')[0],
            frequency: "weekly",
            status: status
          })
          .select()
          .single();

        if (error) throw error;
        orderId = newOrder.id;
        setEditingOrderId(orderId);
      }

      // If submitted and on step 3, create shifts
      if (status === 'submitted' && step === 3 && orderId) {
        await createShifts(orderId);
        toast.success("Order submitted successfully!");
        resetForm();
      } else {
        toast.success(`Order saved as ${status}`);
        if (status === 'submitted' && step < 3) {
          setStep(step + 1);
        }
      }

      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to save order");
    }
  };

  const createShifts = async (orderId: string) => {
    const shiftsToCreate = [];
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + (durationWeeks * 7) - 1);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (selectedDays.includes(dayOfWeek) && selectedTimeSlots[dayOfWeek]) {
        const slot = selectedTimeSlots[dayOfWeek];
        const shiftDate = d.toISOString().split('T')[0];

        // Calculate duration
        const [startHour, startMin] = slot.start.split(':').map(Number);
        const [endHour, endMin] = slot.end.split(':').map(Number);
        const durationHours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;

        shiftsToCreate.push({
          client_id: clientProfile!.id,
          agency_id: clientProfile!.agency_id,
          caregiver_id: selectedCaregiver,
          order_id: orderId,
          shift_date: shiftDate,
          start_time: slot.start,
          end_time: slot.end,
          duration_hours: durationHours,
          care_type_code: selectedCareNeed,
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
    setStartDate("");
    setDurationWeeks(1);
    setSelectedDays([]);
    setSelectedCaregiver("");
    setSelectedTimeSlots({});
    setNotes("");
  };

  const handleEditDraft = async (order: Order) => {
    setEditingOrderId(order.id);
    setStartDate(order.start_date);
    
    // Calculate duration from dates
    const start = new Date(order.start_date);
    const end = new Date(order.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDurationWeeks(Math.ceil(diffDays / 7));
    
    setShowOrderForm(true);
    setStep(1);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const updateTimeSlot = (day: number, type: 'start' | 'end', value: string) => {
    setSelectedTimeSlots(prev => ({
      ...prev,
      [day]: {
        start: type === 'start' ? value : (prev[day]?.start || '09:00'),
        end: type === 'end' ? value : (prev[day]?.end || '17:00')
      }
    }));
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
                <CardDescription>Step {step} of 3</CardDescription>
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
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Package className="h-5 w-5" />
                </div>
                <div className={`h-1 w-16 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Calendar className="h-5 w-5" />
                </div>
                <div className={`h-1 w-16 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Step 1: Select Care Need */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Select Your Care Need</Label>
                  <Select value={selectedCareNeed} onValueChange={setSelectedCareNeed}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose from your care needs" />
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

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => handleSaveOrder('draft')} className="flex-1">
                    Save Draft
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
                    Continue to Dates
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Select Dates & Days */}
            {step === 2 && (
              <div className="space-y-6">
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
                  <Label>Duration (Weeks)</Label>
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
                      type="number"
                      min="1"
                      max="52"
                      value={durationWeeks}
                      onChange={(e) => setDurationWeeks(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                      className="text-center w-20"
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
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Select Days of Week</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {dayNames.map((day, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${index}`}
                          checked={selectedDays.includes(index)}
                          onCheckedChange={() => toggleDay(index)}
                        />
                        <Label htmlFor={`day-${index}`} className="cursor-pointer">
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button variant="outline" onClick={() => handleSaveOrder('draft')} className="flex-1">
                    Save Draft
                  </Button>
                  <Button 
                    onClick={() => {
                      if (startDate && selectedDays.length > 0) {
                        setStep(3);
                      } else {
                        toast.error("Please select start date and days");
                      }
                    }}
                    className="flex-1"
                    disabled={!startDate || selectedDays.length === 0}
                  >
                    View Available Caregivers
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Select Caregiver & Times */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Available Caregivers</Label>
                  {availableCaregivers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No caregivers available for selected days</p>
                  ) : (
                    <div className="space-y-2">
                      {availableCaregivers.map((caregiver) => (
                        <Card 
                          key={caregiver.id}
                          className={`cursor-pointer transition-colors ${selectedCaregiver === caregiver.id ? 'border-primary' : ''}`}
                          onClick={() => setSelectedCaregiver(caregiver.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback>
                                    {caregiver.first_name[0]}{caregiver.last_name[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {caregiver.first_name} {caregiver.last_name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    ${caregiver.hourly_rate}/hr • Rating: {caregiver.performance_rating}/5
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {selectedCaregiver && caregiverAvailability.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Time Slots</Label>
                    <div className="space-y-3">
                      {selectedDays.map(day => {
                        const availableSlot = caregiverAvailability.find(slot => slot.day_of_week === day);
                        return availableSlot ? (
                          <Card key={day}>
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="font-medium">{dayNames[day]}</div>
                                <div className="text-sm text-muted-foreground">
                                  Available: {availableSlot.start_time} - {availableSlot.end_time}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Start Time</Label>
                                    <Input
                                      type="time"
                                      value={selectedTimeSlots[day]?.start || availableSlot.start_time}
                                      onChange={(e) => updateTimeSlot(day, 'start', e.target.value)}
                                      min={availableSlot.start_time}
                                      max={availableSlot.end_time}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">End Time</Label>
                                    <Input
                                      type="time"
                                      value={selectedTimeSlots[day]?.end || availableSlot.end_time}
                                      onChange={(e) => updateTimeSlot(day, 'end', e.target.value)}
                                      min={availableSlot.start_time}
                                      max={availableSlot.end_time}
                                    />
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

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
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button variant="outline" onClick={() => handleSaveOrder('draft')} className="flex-1">
                    Save Draft
                  </Button>
                  <Button onClick={() => handleSaveOrder('submitted')} className="flex-1">
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