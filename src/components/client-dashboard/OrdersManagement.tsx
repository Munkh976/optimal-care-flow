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
  const [selectedCareTypeCodes, setSelectedCareTypeCodes] = useState<string[]>([]);
  
  // Step 2: Caregiver & Time Selection
  const [availableCaregivers, setAvailableCaregivers] = useState<any[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState("");
  const [caregiverAvailability, setCaregiverAvailability] = useState<TimeSlot[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<{[key: number]: {start: string, end: string}}>({});
  const [notes, setNotes] = useState("");
const [startDate, setStartDate] = useState("");
const [sortBy, setSortBy] = useState<"rating" | "price">("rating");
const [durationMonths, setDurationMonths] = useState(1);
const [durationWeeks, setDurationWeeks] = useState(1);
const [careNeedDurationHours, setCareNeedDurationHours] = useState<number | null>(null);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (step === 2 && selectedCareNeed) {
      fetchAvailableCaregivers();
    }
  }, [step, selectedCareNeed, sortBy]);

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
      // Fetch client location for matching
      const { data: clientData, error: clientErr } = await supabase
        .from("clients")
        .select("zip_code")
        .eq("id", clientProfile.id)
        .single();
      if (clientErr) {
        console.warn("Could not load client location:", clientErr);
        toast.error("Could not load client location");
        return;
      }

      const clientZipCode = clientData?.zip_code;
      
      if (!clientZipCode) {
        toast.error("Client zip code not found. Please update your profile.");
        return;
      }

      // Zipcode-only rule: skip skill mapping and AI matching
      let relatedCareTypeCodes: string[] = [];

      // Zipcode-only rule: fetch all active caregivers with availability (no agency or skills filter)
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

      // Filter by zipcode matching: client zipcode must be in caregiver's service_zipcodes
      // Also normalize availability time formats
      const filteredCaregivers = (caregivers || []).filter((cg) => {
        const serviceZipcodes = cg.service_zipcodes || [];
        return serviceZipcodes.includes(clientZipCode);
      }).map((cg) => ({
        ...cg,
        caregiver_availability: (cg.caregiver_availability || [])
          .filter((slot: any) => slot.is_available)
          .map((slot: any) => ({
            ...slot,
            start_time: typeof slot.start_time === "string" ? slot.start_time.slice(0, 5) : slot.start_time,
            end_time: typeof slot.end_time === "string" ? slot.end_time.slice(0, 5) : slot.end_time,
          }))
          .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
      }));
      
      // Sort by rating (default) or price
      const sortedCaregivers = [...filteredCaregivers].sort((a, b) => {
        if (sortBy === "rating") {
          return (b.performance_rating || 0) - (a.performance_rating || 0);
        } else {
          return (a.hourly_rate || 0) - (b.hourly_rate || 0);
        }
      });
      
      setAvailableCaregivers(sortedCaregivers);

      if (filteredCaregivers.length === 0) {
        toast.info("No caregivers available in your area");
      } else {
        toast.success(`Found ${filteredCaregivers.length} matching caregiver(s)`);
      }
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
        .eq("is_available", true)
        .order("day_of_week");

      if (error) throw error;
      const normalize = (t: string) => (typeof t === "string" ? t.slice(0, 5) : t);
      const normalized = (data || []).map((slot) => ({
        ...slot,
        start_time: normalize(slot.start_time as any),
        end_time: normalize(slot.end_time as any),
      }));
      setCaregiverAvailability(normalized as any);
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

    if (step === 2 && status === 'submitted') {
      if (!selectedCaregiver || Object.keys(selectedTimeSlots).length === 0) {
        toast.error("Please select caregiver and time slots");
        return;
      }
      if (!startDate) {
        toast.error("Please select a start date");
        return;
      }
    }

    try {
      const selectedDays = Object.keys(selectedTimeSlots).map(Number);
      const start = new Date(startDate);
      const end = new Date(start);
      // Calculate end date based on duration (months + weeks)
      const totalWeeks = durationMonths * 4 + durationWeeks;
      end.setDate(start.getDate() + (totalWeeks * 7) - 1);

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

      // If submitted and on step 2, create shifts
      if (status === 'submitted' && step === 2 && orderId) {
        await createShifts(orderId, selectedDays);
        toast.success("Order submitted successfully!");
        resetForm();
      } else {
        toast.success(`Order saved as ${status}`);
        if (status === 'submitted' && step < 2) {
          setStep(step + 1);
        }
      }

      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to save order");
    }
  };

  const createShifts = async (orderId: string, selectedDays: number[]) => {
    const shiftsToCreate = [];
    const start = new Date(startDate);
    
    // Calculate end date based on duration (months or weeks)
    const end = new Date(start);
    const totalWeeks = durationMonths * 4 + durationWeeks;
    end.setDate(start.getDate() + (totalWeeks * 7) - 1);

    // Use the primary care type code (first one from the related codes)
    const primaryCareTypeCode = selectedCareTypeCodes[0] || selectedCareNeed;

    // Generate shifts for each week in the duration
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
    setStartDate("");
    setSelectedCaregiver("");
    setSelectedTimeSlots({});
    setNotes("");
    setDurationMonths(1);
setDurationWeeks(1);
setSortBy("rating");
setCareNeedDurationHours(null);
  };

  const handleEditDraft = async (order: Order) => {
    setEditingOrderId(order.id);
    setStartDate(order.start_date);
    setShowOrderForm(true);
    setStep(1);
  };

const updateTimeSlot = (day: number, type: 'start' | 'end', value: string) => {
  setSelectedTimeSlots(prev => {
    const current = prev[day] || { start: '09:00', end: '17:00' };
    let next = { ...current } as { start: string; end: string };

    if (type === 'start') {
      next.start = value;
      // If care need has fixed duration, auto-set end time
      if (careNeedDurationHours && !Number.isNaN(careNeedDurationHours)) {
        const [sh, sm] = value.split(':').map(Number);
        const minutes = sh * 60 + sm + Math.round(careNeedDurationHours * 60);
        const eh = Math.floor(minutes / 60) % 24;
        const em = minutes % 60;
        next.end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      }
    } else {
      next.end = value;
    }

    return { ...prev, [day]: next };
  });
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
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Package className="h-5 w-5" />
                </div>
                <div className={`h-1 w-24 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Users className="h-5 w-5" />
                </div>
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
      // Load duration for the care need
      const { data: cn1 } = await supabase
        .from("care_needs")
        .select("duration_hours, related_care_type_codes")
        .eq("code", value)
        .maybeSingle();
      setCareNeedDurationHours(cn1?.duration_hours ?? null);

      // Prefer explicit mapping
      if (cn1 && Array.isArray(cn1.related_care_type_codes) && cn1.related_care_type_codes.length > 0) {
        setSelectedCareTypeCodes(cn1.related_care_type_codes);
        return;
      }

      // Fallbacks
      const selected = availableCareNeeds.find(n => n.care_need_code === value);
      const needName = selected?.care_needs?.name || "";
      if (needName) {
        const { data: typesByName } = await supabase
          .from("care_types")
          .select("code, name")
          .ilike("name", `%${needName}%`);
        if (typesByName && typesByName.length > 0) {
          setSelectedCareTypeCodes(typesByName.map(t => t.code));
          return;
        }
      }

      const { data: ct } = await supabase
        .from("care_types")
        .select("code")
        .eq("code", value)
        .maybeSingle();
      setSelectedCareTypeCodes(ct?.code ? [ct.code] : []);
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
                    View Caregivers
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Select Caregiver & Times */}
            {step === 2 && (
              <div className="space-y-6">
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Available Caregivers ({availableCaregivers.length})</Label>
                    <Select value={sortBy} onValueChange={(value: "rating" | "price") => {
                      setSortBy(value);
                      fetchAvailableCaregivers();
                    }}>
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
                    <p className="text-sm text-muted-foreground">No caregivers available in your area</p>
                   ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                      {availableCaregivers.map((caregiver) => (
                        <Card 
                          key={caregiver.id}
                          className={`transition-all hover:shadow-md ${selectedCaregiver === caregiver.id ? 'border-primary border-2 bg-primary/5' : ''}`}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div 
                              className="flex items-center justify-between cursor-pointer"
                              onClick={() => {
                                setSelectedCaregiver(caregiver.id);
                                setCaregiverAvailability(caregiver.caregiver_availability || []);
                              }}
                            >
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
                                </div>
                              </div>
                              {selectedCaregiver === caregiver.id && (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            
                            {/* Weekly Availability Grid */}
                            {caregiver.caregiver_availability && caregiver.caregiver_availability.length > 0 && (
                              <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground mb-2 font-medium">Weekly Availability:</p>
                                <div className="grid grid-cols-7 gap-1">
                                  {dayNames.map((day, idx) => {
                                    const slot = caregiver.caregiver_availability?.find((s: any) => s.day_of_week === idx);
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`text-center p-1 rounded text-xs ${
                                          slot 
                                            ? 'bg-primary/10 text-primary border border-primary/20' 
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                        title={slot ? `${day}: ${slot.start_time} - ${slot.end_time}` : `${day}: Not available`}
                                      >
                                        <div className="font-semibold">{day.slice(0, 3)}</div>
                                        {slot && (
                                          <div className="text-[10px] mt-0.5">
                                            {slot.start_time.slice(0, 5)}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                   )}
                </div>

                {selectedCaregiver && caregiverAvailability.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Time Slots</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Select days and times from the caregiver's availability
                    </p>
                    <div className="space-y-3">
                      {caregiverAvailability.map(slot => (
                        <Card key={slot.day_of_week}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`day-${slot.day_of_week}`}
                                  checked={!!selectedTimeSlots[slot.day_of_week]}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      updateTimeSlot(slot.day_of_week, 'start', slot.start_time);
                                      updateTimeSlot(slot.day_of_week, 'end', slot.end_time);
                                    } else {
                                      const newSlots = {...selectedTimeSlots};
                                      delete newSlots[slot.day_of_week];
                                      setSelectedTimeSlots(newSlots);
                                    }
                                  }}
                                />
                                <Label htmlFor={`day-${slot.day_of_week}`} className="font-medium cursor-pointer">
                                  {dayNames[slot.day_of_week]}
                                </Label>
                              </div>
                              {selectedTimeSlots[slot.day_of_week] && (
                                <>
<div className="text-sm text-muted-foreground">
  Available: {slot.start_time} - {slot.end_time} {careNeedDurationHours ? `(duration ${careNeedDurationHours}h)` : ''}
</div>
                                  <div className="grid grid-cols-2 gap-3">
<div className="space-y-1">
  <Label className="text-xs">Start Time</Label>
  <Input
    type="time"
    value={selectedTimeSlots[slot.day_of_week]?.start || slot.start_time}
    onChange={(e) => updateTimeSlot(slot.day_of_week, 'start', e.target.value)}
    min={slot.start_time}
    max={slot.end_time}
  />
</div>
<div className="space-y-1">
  <Label className="text-xs">End Time {careNeedDurationHours ? `(auto: ${careNeedDurationHours}h)` : ''}</Label>
  <Input
    type="time"
    value={selectedTimeSlots[slot.day_of_week]?.end || slot.end_time}
    onChange={(e) => updateTimeSlot(slot.day_of_week, 'end', e.target.value)}
    min={slot.start_time}
    max={slot.end_time}
    readOnly={!!careNeedDurationHours}
  />
</div>
                                  </div>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
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
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button variant="outline" onClick={() => handleSaveOrder('draft')} className="flex-1">
                    Save Draft
                  </Button>
                  <Button 
                    onClick={() => handleSaveOrder('submitted')} 
                    className="flex-1"
                    disabled={!selectedCaregiver || Object.keys(selectedTimeSlots).length === 0 || !startDate}
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