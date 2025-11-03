import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, Edit, Send, Calendar as CalendarIcon, Clock, User, Search, Filter, Trash2, Eye, ChevronDown, ChevronUp, Package, Database, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderShifts, setOrderShifts] = useState<{[key: string]: any[]}>({});
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  
  const [formData, setFormData] = useState({
    client_id: "",
    duration_weeks: "1",
    shifts: [] as Array<{
      selected_days: string[];
      time_slot: string;
      start_time: string;
      care_type: string;
      notes: string;
    }>,
  });

  const [currentShift, setCurrentShift] = useState({
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
    setFilteredOrders(ordersWithCounts as Order[]);
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
    const { client_id, duration_weeks, shifts } = formData;

    if (!client_id || shifts.length === 0) {
      toast.error("Please select a client and add at least one shift");
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
    
    // Collect all unique days across all shifts
    const allDays = new Set<string>();
    shifts.forEach(shift => shift.selected_days.forEach(day => allDays.add(day)));
    const daysOfWeek = Array.from(allDays).join(",");

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
          notes: `${shifts.length} shift configurations`,
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
          notes: `${shifts.length} shift configurations`,
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

    // Generate shifts for each shift configuration, for each week
    const generatedShifts = [];
    const dayMap: { [key: string]: number } = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
    };

    for (const shiftConfig of shifts) {
      for (let week = 0; week < parseInt(duration_weeks); week++) {
        for (const day of shiftConfig.selected_days) {
          const shiftDate = new Date(startDate);
          const targetDay = dayMap[day];
          const currentDay = shiftDate.getDay();
          const daysToAdd = (targetDay - currentDay + 7) % 7;
          shiftDate.setDate(shiftDate.getDate() + daysToAdd + (week * 7));

          const [hours, minutes] = shiftConfig.start_time.split(":");
          const endTimeObj = new Date();
          endTimeObj.setHours(parseInt(hours) + parseInt(shiftConfig.time_slot), parseInt(minutes), 0);

          generatedShifts.push({
            shift_date: shiftDate.toISOString().split("T")[0],
            start_time: shiftConfig.start_time,
            end_time: `${String(endTimeObj.getHours()).padStart(2, "0")}:${String(endTimeObj.getMinutes()).padStart(2, "0")}`,
            care_type: shiftConfig.care_type,
            duration_hours: parseInt(shiftConfig.time_slot),
            notes: shiftConfig.notes,
          });
        }
      }
    }

    // Create shifts
    const shiftInserts = generatedShifts.map((shift) => {
      const careTypeName = careTypes.find(ct => ct.code === shift.care_type)?.name || shift.care_type;
      return {
        agency_id: user.id,
        client_id,
        shift_date: shift.shift_date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        care_type: shift.care_type as any,
        duration_hours: shift.duration_hours,
        status: "open" as any,
        order_title: careTypeName,
        special_notes: shift.notes,
      };
    });

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
      shifts: [],
    });
    setCurrentShift({
      selected_days: [],
      time_slot: "2",
      start_time: "09:00",
      care_type: "",
      notes: "",
    });
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order? This will also delete all associated shifts.")) {
      return;
    }

    // Get order shifts first
    const { data: orderShifts } = await supabase
      .from("order_shifts")
      .select("shift_id")
      .eq("order_id", orderId);

    if (orderShifts && orderShifts.length > 0) {
      const shiftIds = orderShifts.map(os => os.shift_id);
      
      // Delete order_shifts first
      await supabase.from("order_shifts").delete().eq("order_id", orderId);
      
      // Delete shifts
      await supabase.from("shifts").delete().in("id", shiftIds);
    }

    // Delete order
    const { error } = await supabase
      .from("client_orders")
      .delete()
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to delete order");
      console.error(error);
    } else {
      toast.success("Order deleted successfully");
      if (user) fetchOrders(user.id);
    }
  };

  const toggleOrderExpand = async (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
      // Fetch shifts for this order if not already loaded
      if (!orderShifts[orderId]) {
        await fetchOrderShifts(orderId);
      }
    }
    setExpandedOrders(newExpanded);
  };

  const fetchOrderShifts = async (orderId: string) => {
    const { data: orderShiftData } = await supabase
      .from("order_shifts")
      .select("shift_id")
      .eq("order_id", orderId);

    if (orderShiftData && orderShiftData.length > 0) {
      const shiftIds = orderShiftData.map(os => os.shift_id);
      const { data: shifts } = await supabase
        .from("shifts")
        .select("*")
        .in("id", shiftIds)
        .order("shift_date");

      if (shifts) {
        setOrderShifts(prev => ({ ...prev, [orderId]: shifts }));
      }
    }
  };

  // Search and filter effect
  useEffect(() => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(order => 
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${order.clients?.first_name} ${order.clients?.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Period filter
    if (periodFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(order => {
        const orderStart = new Date(order.start_date);
        const orderEnd = new Date(order.end_date);
        
        switch (periodFilter) {
          case "weekly":
            // Current week
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return (orderStart <= weekEnd && orderEnd >= weekStart);
          case "monthly":
            // Current month
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return (orderStart <= monthEnd && orderEnd >= monthStart);
          case "yearly":
            // Current year
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const yearEnd = new Date(now.getFullYear(), 11, 31);
            return (orderStart <= yearEnd && orderEnd >= yearStart);
          default:
            return true;
        }
      });
    }

    setFilteredOrders(filtered);
  }, [searchQuery, statusFilter, periodFilter, orders]);

  const handleAddShift = () => {
    if (currentShift.selected_days.length === 0 || !currentShift.care_type) {
      toast.error("Please select days and care type for the shift");
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      shifts: [...prev.shifts, { ...currentShift }],
    }));
    
    setCurrentShift({
      selected_days: [],
      time_slot: "2",
      start_time: "09:00",
      care_type: "",
      notes: "",
    });
    
    toast.success("Shift added to order");
  };

  const handleRemoveShift = (index: number) => {
    setFormData(prev => ({
      ...prev,
      shifts: prev.shifts.filter((_, i) => i !== index),
    }));
  };

  const handleOpenEditDialog = async (order: Order) => {
    setSelectedOrder(order);
    
    // Calculate duration in weeks
    const start = new Date(order.start_date);
    const end = new Date(order.end_date);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const weeks = Math.ceil(diffDays / 7);

    // Get all shifts to reconstruct shift configurations
    const { data: orderShifts } = await supabase
      .from("order_shifts")
      .select("shift_id")
      .eq("order_id", order.id);

    const reconstructedShifts: Array<{
      selected_days: string[];
      time_slot: string;
      start_time: string;
      care_type: string;
      notes: string;
    }> = [];

    if (orderShifts && orderShifts.length > 0) {
      const shiftIds = orderShifts.map(os => os.shift_id);
      const { data: shifts } = await supabase
        .from("shifts")
        .select("*")
        .in("id", shiftIds)
        .order("shift_date");

      if (shifts && shifts.length > 0) {
        // Group shifts by their configuration (time, care_type, duration)
        const configMap = new Map<string, Set<string>>();
        
        shifts.forEach(shift => {
          const key = `${shift.start_time}-${shift.care_type}-${shift.duration_hours}`;
          if (!configMap.has(key)) {
            configMap.set(key, new Set());
          }
          const shiftDate = new Date(shift.shift_date);
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          configMap.get(key)!.add(dayNames[shiftDate.getDay()]);
        });

        configMap.forEach((days, key) => {
          const [start_time, care_type, duration] = key.split("-");
          const firstShift = shifts.find(s => 
            s.start_time === start_time && 
            s.care_type === care_type && 
            s.duration_hours?.toString() === duration
          );
          
          reconstructedShifts.push({
            selected_days: Array.from(days),
            time_slot: duration,
            start_time,
            care_type,
            notes: firstShift?.special_notes || "",
          });
        });
      }
    }

    setFormData({
      client_id: order.client_id,
      duration_weeks: weeks.toString(),
      shifts: reconstructedShifts,
    });
    setIsAddDialogOpen(true);
  };

  const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const toggleDay = (day: string) => {
    setCurrentShift((prev) => ({
      ...prev,
      selected_days: prev.selected_days.includes(day)
        ? prev.selected_days.filter((d) => d !== day)
        : [...prev.selected_days, day],
    }));
  };

  const handleGenerateSampleData = async () => {
    if (!user || clients.length === 0 || careTypes.length === 0) {
      toast.error("Please ensure you have clients and care types before generating sample data");
      return;
    }

    const confirmGenerate = confirm("This will create 5-10 sample orders with shifts. Continue?");
    if (!confirmGenerate) return;

    toast.info("Generating sample orders...");

    try {
      const numberOfOrders = Math.floor(Math.random() * 6) + 5; // 5-10 orders
      const sampleOrders = [];

      for (let i = 0; i < numberOfOrders; i++) {
        const randomClient = clients[Math.floor(Math.random() * clients.length)];
        const randomCareType = careTypes[Math.floor(Math.random() * careTypes.length)];
        
        // Random date in the past 3 months or future 2 months
        const daysOffset = Math.floor(Math.random() * 150) - 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + daysOffset);
        
        const duration = Math.floor(Math.random() * 8) + 1; // 1-8 weeks
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (duration * 7));

        const statuses = ['draft', 'active', 'completed', 'submitted'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        const orderNumber = `ORD-${Date.now()}-${i}`;

        // Create order
        const { data: orderData, error: orderError } = await supabase
          .from("client_orders")
          .insert({
            agency_id: user.id,
            client_id: randomClient.id,
            order_number: orderNumber,
            start_date: startDate.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
            frequency: "weekly",
            days_of_week: "Mon,Wed,Fri",
            notes: `Sample order for ${randomClient.first_name} ${randomClient.last_name}`,
            status: randomStatus,
          })
          .select()
          .single();

        if (orderError || !orderData) {
          console.error("Error creating sample order:", orderError);
          continue;
        }

        // Generate 3-7 shifts for this order
        const numberOfShifts = Math.floor(Math.random() * 5) + 3;
        const shiftInserts = [];

        for (let j = 0; j < numberOfShifts; j++) {
          const shiftDate = new Date(startDate);
          shiftDate.setDate(shiftDate.getDate() + (j * 2)); // Every 2 days

          const startHour = Math.floor(Math.random() * 12) + 8; // 8am-8pm
          const durationHours = [2, 4, 6, 8][Math.floor(Math.random() * 4)];
          const endHour = startHour + durationHours;

          shiftInserts.push({
            agency_id: user.id,
            client_id: randomClient.id,
            shift_date: shiftDate.toISOString().split("T")[0],
            start_time: `${String(startHour).padStart(2, "0")}:00`,
            end_time: `${String(endHour).padStart(2, "0")}:00`,
            care_type: randomCareType.code,
            duration_hours: durationHours,
            status: randomStatus === 'draft' ? 'open' : randomStatus === 'active' ? 'open' : 'filled',
            order_title: randomCareType.name,
            special_notes: `Sample shift ${j + 1}`,
          });
        }

        const { data: shiftData, error: shiftError } = await supabase
          .from("shifts")
          .insert(shiftInserts)
          .select();

        if (!shiftError && shiftData) {
          // Link shifts to order
          const orderShiftInserts = shiftData.map((shift) => ({
            order_id: orderData.id,
            shift_id: shift.id,
          }));

          await supabase.from("order_shifts").insert(orderShiftInserts);
        }
      }

      toast.success(`Successfully generated ${numberOfOrders} sample orders!`);
      if (user) fetchOrders(user.id);
    } catch (error) {
      console.error("Error generating sample data:", error);
      toast.error("Failed to generate sample data");
    }
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
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold">Order Management</h2>
            <p className="text-muted-foreground mt-1">Manage client care orders and schedules</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerateSampleData}>
              <Database className="mr-2 h-4 w-4" />
              Generate Sample Data
            </Button>
            <Button variant="secondary" onClick={() => navigate("/auto-schedule")}>
              <Zap className="mr-2 h-4 w-4" />
              Auto Schedule
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order # or client name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    <SelectItem value="weekly">This Week</SelectItem>
                    <SelectItem value="monthly">This Month</SelectItem>
                    <SelectItem value="yearly">This Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{orders.length}</div>
                <div className="text-sm text-muted-foreground">Total Orders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{orders.filter(o => o.status === 'active').length}</div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'draft').length}</div>
                <div className="text-sm text-muted-foreground">Drafts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{orders.reduce((sum, o) => sum + (o.shift_count || 0), 0)}</div>
                <div className="text-sm text-muted-foreground">Total Shifts</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {orders.length === 0 ? "No orders found. Create your first order to get started." : "No orders match your filters."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <>
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleOrderExpand(order.id)}
                          >
                            {expandedOrders.has(order.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {order.clients?.first_name} {order.clients?.last_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(order.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(order.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{order.shift_count || 0}</span> shifts
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            order.status === "submitted" || order.status === "active" ? "default" : 
                            order.status === "draft" ? "secondary" : 
                            order.status === "completed" ? "outline" : "destructive"
                          }>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOrderExpand(order.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditDialog(order);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(order.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedOrders.has(order.id) && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="p-4">
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Order Items (Shifts)
                              </h4>
                              {orderShifts[order.id] && orderShifts[order.id].length > 0 ? (
                                <div className="space-y-2">
                                  {orderShifts[order.id].map((shift, idx) => {
                                    const careTypeName = careTypes.find(ct => ct.code === shift.care_type)?.name || shift.care_type;
                                    return (
                                      <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                        <div className="flex-1 grid grid-cols-5 gap-4">
                                          <div>
                                            <div className="text-sm text-muted-foreground">Date</div>
                                            <div className="font-medium">{new Date(shift.shift_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground">Care Type</div>
                                            <div className="font-medium">{careTypeName}</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground">Time</div>
                                            <div className="font-medium">{shift.start_time} - {shift.end_time}</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground">Duration</div>
                                            <div className="font-medium">{shift.duration_hours}h</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground">Status</div>
                                            <Badge variant={shift.status === 'open' ? 'secondary' : 'default'} className="w-fit">
                                              {shift.status}
                                            </Badge>
                                          </div>
                                        </div>
                                        {shift.special_notes && (
                                          <div className="ml-4 text-sm text-muted-foreground max-w-xs">
                                            {shift.special_notes}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                  Loading shifts...
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
                  <Input
                    type="number"
                    min="1"
                    max="52"
                    value={formData.duration_weeks}
                    onChange={(e) => setFormData({ ...formData, duration_weeks: e.target.value })}
                    placeholder="Enter number of weeks (1-52)"
                  />
                </div>

                {/* Added Shifts Display */}
                {formData.shifts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Added Shifts ({formData.shifts.length})</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {formData.shifts.map((shift, index) => {
                        const careTypeName = careTypes.find(ct => ct.code === shift.care_type)?.name || shift.care_type;
                        return (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                            <div className="flex-1">
                              <div className="font-medium">{careTypeName}</div>
                              <div className="text-muted-foreground">
                                {shift.selected_days.join(", ")} • {shift.start_time} • {shift.time_slot}h
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveShift(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Current Shift Builder */}
                <div className="border-t pt-4 space-y-4">
                  <Label className="text-base font-semibold">Add New Shift</Label>
                  
                  <div>
                    <Label>Select Days *</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {dayOptions.map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`current-${day}`}
                            checked={currentShift.selected_days.includes(day)}
                            onCheckedChange={() => toggleDay(day)}
                          />
                          <label htmlFor={`current-${day}`} className="text-sm cursor-pointer">
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
                        value={currentShift.start_time}
                        onChange={(e) => setCurrentShift({ ...currentShift, start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Duration *</Label>
                      <Select
                        value={currentShift.time_slot}
                        onValueChange={(value) => setCurrentShift({ ...currentShift, time_slot: value })}
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
                      value={currentShift.care_type}
                      onValueChange={(value) => setCurrentShift({ ...currentShift, care_type: value })}
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
                      value={currentShift.notes}
                      onChange={(e) => setCurrentShift({ ...currentShift, notes: e.target.value })}
                      placeholder="Add any special instructions..."
                      rows={2}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddShift}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Shift to Order
                  </Button>
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