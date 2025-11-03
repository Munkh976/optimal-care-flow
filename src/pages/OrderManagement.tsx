import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, Edit, Send, Calendar as CalendarIcon, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

type Order = {
  id: string;
  order_number: string;
  client_id: string;
  start_date: string;
  end_date: string;
  frequency: string;
  days_of_week: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  clients?: {
    first_name: string;
    last_name: string;
  };
  shift_count?: number;
};

const OrderManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState({
    client_id: "",
    duration_weeks: "1",
    selected_days: [] as string[],
    time_slot: "2",
    start_time: "09:00",
    care_type: "",
    notes: "",
  });

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
        fetchOrders(session.user.id);
        fetchClients(session.user.id);
        fetchCareTypes();
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

  const fetchOrders = async (userId: string) => {
    const { data: ordersData, error: ordersError } = await supabase
      .from("client_orders")
      .select(`
        *,
        clients(first_name, last_name)
      `)
      .eq("agency_id", userId)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      toast.error("Failed to load orders");
      setLoading(false);
      return;
    }

    // Get shift counts for each order
    const ordersWithCounts = await Promise.all(
      (ordersData || []).map(async (order) => {
        const { count } = await supabase
          .from("order_shifts")
          .select("*", { count: "exact", head: true })
          .eq("order_id", order.id);
        
        return { ...order, shift_count: count || 0 };
      })
    );

    setOrders(ordersWithCounts as Order[]);
    setLoading(false);
  };

  const fetchClients = async (userId: string) => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .eq("agency_id", userId)
      .eq("is_active", true)
      .order("first_name");

    if (error) {
      console.error("Error fetching clients:", error);
    } else {
      setClients(data || []);
    }
  };

  const fetchCareTypes = async () => {
    const { data, error } = await supabase
      .from("care_types")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching care types:", error);
    } else {
      setCareTypes(data || []);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleSaveOrder = async (status: "draft" | "submitted") => {
    const { selected_days, duration_weeks, time_slot, start_time, care_type, client_id, notes } = formData;

    if (!client_id || selected_days.length === 0 || !care_type) {
      toast.error("Please fill all required fields");
      return;
    }

    // Calculate start and end dates (next Monday onwards)
    const now = new Date();
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + daysUntilMonday);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (parseInt(duration_weeks) * 7) - 1);

    const orderNumber = selectedOrder?.order_number || `ORD-${Date.now()}`;
    const daysOfWeek = selected_days.join(",");

    // Create or update order
    let orderId = selectedOrder?.id;

    if (selectedOrder) {
      const { error: updateError } = await supabase
        .from("client_orders")
        .update({
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          frequency: "weekly",
          days_of_week: daysOfWeek,
          notes,
          status,
        })
        .eq("id", selectedOrder.id);

      if (updateError) {
        toast.error("Failed to update order");
        console.error(updateError);
        return;
      }

      // Delete existing order_shifts and shifts
      const { data: existingOrderShifts } = await supabase
        .from("order_shifts")
        .select("shift_id")
        .eq("order_id", selectedOrder.id);

      if (existingOrderShifts) {
        const shiftIds = existingOrderShifts.map(os => os.shift_id);
        await supabase.from("order_shifts").delete().eq("order_id", selectedOrder.id);
        await supabase.from("shifts").delete().in("id", shiftIds);
      }
    } else {
      const { data: orderData, error: orderError } = await supabase
        .from("client_orders")
        .insert({
          agency_id: user.id,
          client_id,
          order_number: orderNumber,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          frequency: "weekly",
          days_of_week: daysOfWeek,
          notes,
          status,
        })
        .select()
        .single();

      if (orderError || !orderData) {
        toast.error("Failed to create order");
        console.error(orderError);
        return;
      }
      orderId = orderData.id;
    }

    // Generate shifts for each week and selected days
    const shifts = [];
    const dayMap: { [key: string]: number } = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
    };

    for (let week = 0; week < parseInt(duration_weeks); week++) {
      for (const day of selected_days) {
        const shiftDate = new Date(startDate);
        const targetDay = dayMap[day];
        const currentDay = shiftDate.getDay();
        const daysToAdd = (targetDay - currentDay + 7) % 7;
        shiftDate.setDate(shiftDate.getDate() + daysToAdd + (week * 7));

        const [hours, minutes] = start_time.split(":");
        const endTimeObj = new Date();
        endTimeObj.setHours(parseInt(hours) + parseInt(time_slot), parseInt(minutes), 0);

        shifts.push({
          shift_date: shiftDate.toISOString().split("T")[0],
          start_time: start_time,
          end_time: `${String(endTimeObj.getHours()).padStart(2, "0")}:${String(endTimeObj.getMinutes()).padStart(2, "0")}`,
          care_type,
          duration_hours: parseInt(time_slot),
        });
      }
    }

    // Create shifts
    const careTypeName = careTypes.find(ct => ct.code === care_type)?.name || care_type;
    const shiftInserts = shifts.map((shift) => ({
      agency_id: user.id,
      client_id,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      care_type: shift.care_type as any,
      duration_hours: shift.duration_hours,
      status: "open" as any,
      order_title: careTypeName,
    }));

    const { data: shiftData, error: shiftError } = await supabase
      .from("shifts")
      .insert(shiftInserts)
      .select();

    if (shiftError || !shiftData) {
      toast.error("Failed to create shifts");
      console.error(shiftError);
      return;
    }

    // Link shifts to order
    const orderShiftInserts = shiftData.map((shift) => ({
      order_id: orderId,
      shift_id: shift.id,
    }));

    const { error: linkError } = await supabase
      .from("order_shifts")
      .insert(orderShiftInserts);

    if (linkError) {
      toast.error("Failed to link shifts to order");
      console.error(linkError);
      return;
    }

    toast.success(status === "draft" ? "Order saved as draft" : "Order submitted successfully");
    handleCloseDialog();
    if (user) fetchOrders(user.id);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedOrder(null);
    setFormData({
      client_id: "",
      duration_weeks: "1",
      selected_days: [],
      time_slot: "2",
      start_time: "09:00",
      care_type: "",
      notes: "",
    });
  };

  const handleOpenEditDialog = async (order: Order) => {
    setSelectedOrder(order);
    
    // Calculate duration in weeks
    const start = new Date(order.start_date);
    const end = new Date(order.end_date);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const weeks = Math.ceil(diffDays / 7);

    // Get first shift to populate form
    const { data: orderShifts } = await supabase
      .from("order_shifts")
      .select("shift_id")
      .eq("order_id", order.id)
      .limit(1);

    let timeSlot = "2";
    let startTime = "09:00";
    let careType = "";

    if (orderShifts && orderShifts.length > 0) {
      const { data: shift } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", orderShifts[0].shift_id)
        .single();

      if (shift) {
        timeSlot = shift.duration_hours?.toString() || "2";
        startTime = shift.start_time;
        careType = shift.care_type;
      }
    }

    setFormData({
      client_id: order.client_id,
      duration_weeks: weeks.toString(),
      selected_days: order.days_of_week?.split(",") || [],
      time_slot: timeSlot,
      start_time: startTime,
      care_type: careType,
      notes: order.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      selected_days: prev.selected_days.includes(day)
        ? prev.selected_days.filter((d) => d !== day)
        : [...prev.selected_days, day],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">CareMuch</h1>
              <p className="text-sm text-muted-foreground">{profile?.agency_name || "Care Agency"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.full_name || user?.email}
            </span>
            <Button variant="outline" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Order Management</h2>
            <p className="text-muted-foreground mt-1">Manage weekly client orders</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>

        <div className="grid gap-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No orders found. Create your first order to get started.
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {order.order_number}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        {order.clients?.first_name} {order.clients?.last_name}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={order.status === "submitted" ? "default" : "secondary"}>
                        {order.status}
                      </Badge>
                      {order.status === "draft" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditDialog(order)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {new Date(order.start_date).toLocaleDateString()} - {new Date(order.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{order.days_of_week}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">{order.shift_count || 0}</span> shifts scheduled
                    </div>
                    {order.notes && (
                      <div className="col-span-2 text-muted-foreground">{order.notes}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedOrder ? "Edit Order" : "Create Weekly Order"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label>Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                    disabled={!!selectedOrder}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.first_name} {client.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Duration (Weeks) *</Label>
                  <Select
                    value={formData.duration_weeks}
                    onValueChange={(value) => setFormData({ ...formData, duration_weeks: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 8, 12].map((weeks) => (
                        <SelectItem key={weeks} value={weeks.toString()}>
                          {weeks} {weeks === 1 ? "week" : "weeks"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Select Days *</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {dayOptions.map((day) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={day}
                          checked={formData.selected_days.includes(day)}
                          onCheckedChange={() => toggleDay(day)}
                        />
                        <label htmlFor={day} className="text-sm cursor-pointer">
                          {day}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Time *</Label>
                    <Input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Duration *</Label>
                    <Select
                      value={formData.time_slot}
                      onValueChange={(value) => setFormData({ ...formData, time_slot: value })}
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

                <div>
                  <Label>Care Type *</Label>
                  <Select
                    value={formData.care_type}
                    onValueChange={(value) => setFormData({ ...formData, care_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select care type" />
                    </SelectTrigger>
                    <SelectContent>
                      {careTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.code}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any special instructions..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSaveOrder("draft")}
                >
                  Save as Draft
                </Button>
                <Button
                  onClick={() => handleSaveOrder("submitted")}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit Order
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default OrderManagement;