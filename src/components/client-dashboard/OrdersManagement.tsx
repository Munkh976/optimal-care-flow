import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight, Package, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

interface CareNeedInput {
  care_need_code: string;
  selected_days: number[];
  start_time: string;
  duration: number;
  notes: string;
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
  const [durationWeeks, setDurationWeeks] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [careNeedInputs, setCareNeedInputs] = useState<CareNeedInput[]>([]);
  const [showOrderForm, setShowOrderForm] = useState(false);

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  };

  const handleSaveOrder = async (status: 'draft' | 'submitted') => {
    if (!clientProfile) {
      toast.error("Client profile not found");
      return;
    }

    if (step === 1) {
      if (!startDate || durationWeeks < 1 || durationWeeks > 52) {
        toast.error("Please select a valid start date and duration");
        return;
      }

      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(start.getDate() + (durationWeeks * 7) - 1);

      try {
        if (currentOrder) {
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

          if (error) throw error;
          toast.success(status === 'draft' ? "Order saved as draft" : "Moving to care needs...");
          if (status === 'submitted') setStep(2);
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
          toast.success(status === 'draft' ? "Order saved as draft" : "Moving to care needs...");
          if (status === 'submitted') setStep(2);
        }
        onRefresh();
      } catch (error: any) {
        toast.error(error.message || "Failed to save order");
      }
    } else {
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
              const [hours, minutes] = careNeed.start_time.split(':');
              const endDate = new Date(d);
              endDate.setHours(parseInt(hours) + careNeed.duration, parseInt(minutes));
              const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

              shiftsToCreate.push({
                client_id: clientProfile.id,
                agency_id: user.id,
                order_id: currentOrder!.id,
                shift_date: shiftDate,
                start_time: careNeed.start_time,
                end_time: endTime,
                duration_hours: careNeed.duration,
                care_type_code: careNeed.care_need_code,
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

        const { error: updateError } = await supabase
          .from("client_orders")
          .update({ status: status })
          .eq("id", currentOrder!.id);

        if (updateError) throw updateError;

        toast.success("Order submitted successfully!");
        setCareNeedInputs([]);
        setShowOrderForm(false);
        setStep(1);
        onRefresh();
      } catch (error: any) {
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
  };

  const handleRemoveCareNeed = (index: number) => {
    setCareNeedInputs(careNeedInputs.filter((_, i) => i !== index));
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
      {/* Header with Create Button */}
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

      {/* Create Order Form */}
      {showOrderForm && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Create Weekly Order</CardTitle>
                <CardDescription>Step {step} of 2</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                setShowOrderForm(false);
                setStep(1);
                setCareNeedInputs([]);
              }}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Progress Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Calendar className="h-5 w-5" />
                </div>
                <div className={`h-1 w-16 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Package className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Step 1: Order Details */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date (Monday)</Label>
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

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => handleSaveOrder('draft')} className="flex-1">
                    Save Draft
                  </Button>
                  <Button onClick={() => handleSaveOrder('submitted')} className="flex-1">
                    Continue to Care Needs
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Care Needs */}
            {step === 2 && (
              <div className="space-y-6">
                <Button onClick={handleAddCareNeed} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Care Need
                </Button>

                {careNeedInputs.map((input, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Care Need #{index + 1}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCareNeed(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Care Need Type</Label>
                        <Select
                          value={input.care_need_code}
                          onValueChange={(value) => updateCareNeedInput(index, 'care_need_code', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select care need" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCareNeeds.map((need) => (
                              <SelectItem key={need.id} value={need.care_need_code}>
                                {need.care_needs.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Days of Week</Label>
                        <div className="flex gap-2 flex-wrap">
                          {dayNames.map((day, dayIndex) => (
                            <Button
                              key={dayIndex}
                              type="button"
                              variant={input.selected_days.includes(dayIndex) ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleDay(index, dayIndex)}
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
                            value={input.start_time}
                            onChange={(e) => updateCareNeedInput(index, 'start_time', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (hours)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            value={input.duration}
                            onChange={(e) => updateCareNeedInput(index, 'duration', parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={input.notes}
                          onChange={(e) => updateCareNeedInput(index, 'notes', e.target.value)}
                          placeholder="Any special instructions..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={() => handleSaveOrder('draft')} variant="outline" className="flex-1">
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
                {getStatusBadge(currentOrder.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{currentOrder.frequency}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Created {new Date(currentOrder.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first care order to get started</p>
              <Button onClick={() => setShowOrderForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Order
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
